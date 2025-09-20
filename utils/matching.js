const natural = require('natural');
const { cosine } = require('ml-distance');
const { User, Course, UserActivity } = require('../models/db_schema');

class CourseMatcher {
  /**
   * Calculate cosine similarity between user profile and course
   */
  static calculateSimilarity(userVector, courseVector) {
    if (!userVector || !courseVector || userVector.length !== courseVector.length) {
      return 0;
    }
    return cosine(userVector, courseVector);
  }

  /**
   * Create feature vector from user interests and skills
   */
  static createUserVector(user) {
    const interests = user.interests || [];
    const skills = user.profile?.skills || [];
    const experience = user.profile?.experience || 'beginner';

    // Create a simple bag-of-words approach
    const allTerms = [...interests, ...skills, experience];
    return this.termsToVector(allTerms);
  }

  /**
   * Create feature vector from course data
   */
  static createCourseVector(course) {
    const tags = course.tags || [];
    const title = course.title || '';
    const description = course.description || '';
    const difficulty = course.difficulty || 'beginner';
    const category = course.category || '';

    // Extract keywords from title and description
    const titleWords = natural.WordTokenizer.tokenize(title.toLowerCase()) || [];
    const descWords = natural.WordTokenizer.tokenize(description.toLowerCase()) || [];

    const allTerms = [...tags, ...titleWords.slice(0, 5), ...descWords.slice(0, 10), difficulty, category].filter(term => term !== '');
    return this.termsToVector(allTerms);
  }

  /**
   * Convert terms to numerical vector using TF-IDF like approach
   */
  static termsToVector(terms) {
    const vector = [];
    const uniqueTerms = [...new Set(terms)];

    // Simple term frequency vector
    uniqueTerms.forEach(term => {
      const count = terms.filter(t => t === term).length;
      vector.push(count);
    });

    return vector;
  }

  /**
   * Get course recommendations for a user
   */
  static async getRecommendations(userId, limit = 10) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.preferences?.matchingConsent) {
        return [];
      }

      // Get user's activity history for collaborative filtering
      const userActivities = await UserActivity.find({ userId })
        .populate('resourceId')
        .sort({ createdAt: -1 })
        .limit(20);

      const courses = await Course.find({}).lean();
      const userVector = this.createUserVector(user);

      const recommendations = courses.map(course => {
        const courseVector = this.createCourseVector(course);
        const similarity = this.calculateSimilarity(userVector, courseVector);

        // Boost score based on user activity
        let activityBoost = 0;
        const viewedCourse = userActivities.find(activity =>
          activity.resourceType === 'course' &&
          activity.resourceId._id.toString() === course._id.toString()
        );
        if (viewedCourse) {
          activityBoost = viewedCourse.weight * 0.1;
        }

        return {
          course,
          score: similarity + activityBoost,
          similarity
        };
      });

      // Sort by score and return top recommendations
      return recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => ({
          ...item.course,
          matchScore: Math.round(item.score * 100) / 100,
          similarity: Math.round(item.similarity * 100) / 100
        }));

    } catch (error) {
      console.error('Error getting recommendations:', error);
      return [];
    }
  }

  /**
   * Get user recommendations based on course interests
   */
  static async getUserRecommendations(userId, limit = 10) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.preferences?.matchingConsent) {
        return [];
      }

      const users = await User.find({
        _id: { $ne: userId },
        'preferences.matchingConsent': true
      }).lean();

      const userVector = this.createUserVector(user);

      const recommendations = users.map(otherUser => {
        const otherVector = this.createUserVector(otherUser);
        const similarity = this.calculateSimilarity(userVector, otherVector);

        return {
          user: otherUser,
          similarity
        };
      });

      return recommendations
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(item => ({
          ...item.user,
          matchScore: Math.round(item.similarity * 100) / 100
        }));

    } catch (error) {
      console.error('Error getting user recommendations:', error);
      return [];
    }
  }
}

module.exports = CourseMatcher;