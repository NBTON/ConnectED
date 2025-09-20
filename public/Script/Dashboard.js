const { useState, useEffect } = React;

function Dashboard() {
  const [theme, setTheme] = useState('light');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);

    const html = document.documentElement;
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Trigger custom event for other components
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return React.createElement(
    'div',
    { className: 'dashboard-container grid grid-cols-1 lg:grid-cols-4 gap-6' },

    // Main Content Area
    React.createElement(
      'div',
      { className: 'lg:col-span-3 space-y-6' },

      // Welcome Header
      React.createElement(
        'div',
        { className: 'bg-gradient-to-r from-primary to-blue-700 text-white rounded-xl p-6 shadow-lg' },
        React.createElement(
          'div',
          { className: 'flex justify-between items-center' },
          React.createElement(
            'div',
            null,
            React.createElement('h4', { className: 'text-2xl font-bold mb-1' }, 'Welcome back!'),
            React.createElement('p', { className: 'opacity-90' }, formatDate(currentTime))
          ),
          React.createElement(
            'div',
            { className: 'text-right' },
            React.createElement('div', { className: 'text-3xl mb-0 font-bold' }, formatTime(currentTime)),
            React.createElement('small', { className: 'opacity-90 block' }, 'Current time')
          )
        )
      ),

      // Activity Feed
      React.createElement(
        'div',
        { className: 'bg-white rounded-xl shadow-md overflow-hidden' },
        React.createElement(
          'div',
          { className: 'flex justify-between items-center p-6 border-b border-neutral/20 bg-neutral/50' },
          React.createElement('h5', { className: 'text-xl font-bold flex items-center' },
            React.createElement('i', { className: 'fas fa-rss mr-2 text-primary' }),
            'Activity Feed'
          ),
          React.createElement(
            'button',
            {
              className: 'px-3 py-1 rounded-lg border border-neutral/30 text-textPrimary hover:bg-neutral/50 transition-colors text-sm font-medium',
              onClick: toggleTheme,
              'aria-label': 'Toggle theme'
            },
            theme === 'light' ? '🌙 Dark' : '☀️ Light'
          )
        ),
        React.createElement(
          'div',
          { className: 'p-6 text-center text-textSecondary' },
          React.createElement('i', { className: 'fas fa-rss text-4xl mb-3 block text-primary' }),
          React.createElement('h6', { className: 'font-bold mb-2 text-textPrimary' }, 'Recent Activity'),
          React.createElement('p', { className: 'mb-0' }, 'Your latest study activities and group updates will appear here')
        )
      ),

      // Stats Cards
      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
        React.createElement(
          'div',
          { className: 'bg-white rounded-xl shadow-md p-6 border border-neutral/20 hover:shadow-lg transition-all duration-300' },
          React.createElement('div', { className: 'w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4' },
            React.createElement('i', { className: 'fas fa-chart-bar text-2xl text-primary' })
          ),
          React.createElement('h6', { className: 'text-xl font-bold text-textPrimary text-center mb-3' }, 'Study Progress'),
          React.createElement('p', { className: 'text-textSecondary text-center mb-4 text-sm' }, 'Track your learning progress'),
          React.createElement('div', { className: 'w-full bg-neutral/20 rounded-full h-2 mb-2' },
            React.createElement('div', {
              className: 'bg-primary h-2 rounded-full transition-all duration-300',
              style: { width: '65%' },
              role: 'progressbar',
              'aria-valuenow': '65',
              'aria-valuemin': '0',
              'aria-valuemax': '100'
            })
          ),
          React.createElement('small', { className: 'text-textSecondary block text-center' }, '65% Complete')
        ),
        React.createElement(
          'div',
          { className: 'bg-white rounded-xl shadow-md p-6 border border-neutral/20 hover:shadow-lg transition-all duration-300' },
          React.createElement('div', { className: 'w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4' },
            React.createElement('i', { className: 'fas fa-trophy text-2xl text-yellow-600' })
          ),
          React.createElement('h6', { className: 'text-xl font-bold text-textPrimary text-center mb-3' }, 'Achievements'),
          React.createElement('p', { className: 'text-textSecondary text-center mb-4 text-sm' }, 'Your learning milestones'),
          React.createElement('div', { className: 'flex justify-center gap-2 flex-wrap' },
            React.createElement('span', { className: 'bg-success text-white px-3 py-1 rounded-full text-sm font-medium' }, '5 courses'),
            React.createElement('span', { className: 'bg-info text-white px-3 py-1 rounded-full text-sm font-medium' }, '3 groups')
          )
        )
      )
    ),

    // Sidebar
    React.createElement(
      'div',
      { className: 'lg:col-span-1 space-y-6' },

      // Quick Actions
      React.createElement(
        'div',
        { className: 'bg-white rounded-xl shadow-md overflow-hidden' },
        React.createElement(
          'div',
          { className: 'p-6 border-b border-neutral/20 bg-neutral/50' },
          React.createElement('h6', { className: 'text-xl font-bold flex items-center text-textPrimary' },
            React.createElement('i', { className: 'fas fa-bolt mr-2 text-warning' }),
            'Quick Actions'
          )
        ),
        React.createElement(
          'div',
          { className: 'p-0' },
          React.createElement(
            'a',
            { href: '/courses', className: 'block px-6 py-3 border-b border-neutral/20 text-textPrimary hover:bg-neutral/50 transition-colors font-medium' },
            React.createElement('i', { className: 'fas fa-plus mr-2 text-primary' }),
            'Join a Group'
          ),
          React.createElement(
            'a',
            { href: '/courses', className: 'block px-6 py-3 border-b border-neutral/20 text-textPrimary hover:bg-neutral/50 transition-colors font-medium' },
            React.createElement('i', { className: 'fas fa-search mr-2 text-secondary' }),
            'Find Courses'
          ),
          React.createElement(
            'a',
            { href: '/me', className: 'block px-6 py-3 border-b border-neutral/20 text-textPrimary hover:bg-neutral/50 transition-colors font-medium' },
            React.createElement('i', { className: 'fas fa-user mr-2 text-info' }),
            'My Profile'
          ),
          React.createElement(
            'a',
            { href: '/courses/add', className: 'block px-6 py-3 text-white bg-primary hover:bg-blue-700 transition-colors font-medium' },
            React.createElement('i', { className: 'fas fa-plus-circle mr-2' }),
            'Add Course'
          )
        )
      ),

      // Profile Card
      React.createElement(
        'div',
        { className: 'bg-white rounded-xl shadow-md p-6 text-center border border-neutral/20' },
        React.createElement('div', { className: 'mb-4' },
          React.createElement('i', { className: 'fas fa-user-circle text-6xl text-neutral mb-3 block' })
        ),
        React.createElement('h6', { className: 'font-bold text-xl text-textPrimary mb-1' }, 'Welcome Back!'),
        React.createElement('p', { className: 'text-textSecondary mb-4 text-sm' }, 'Your personalized dashboard'),
        React.createElement('div', { className: 'space-y-1' },
          React.createElement('span', { className: 'inline-block bg-primary text-white px-3 py-1 rounded-full text-sm font-medium' }, 'Student'),
          React.createElement('small', { className: 'text-textSecondary block text-center' }, 'Member since 2024')
        )
      )
    )
  );
}

// Render the Dashboard component when the DOM is ready
if (document.getElementById('dashboard-root')) {
  const root = ReactDOM.createRoot(document.getElementById('dashboard-root'));
  root.render(React.createElement(Dashboard));
}