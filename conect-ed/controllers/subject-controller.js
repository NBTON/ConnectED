const { Subjects } = require("../models/db_schema")

const multer = require("multer");

const RECORD_PER_PAGE = 6

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "public/images"),
    filename: (req, file, cb) => {
        const fileName = `${Date.now()}_${file.originalname}`;
        return cb(null, fileName);
    },
})

const multerStorage = multer({ storage });

const addSubjectPostAction = async (req, res) => {
    try {
        const newSubject = await new Subjects({ ...req.body, image: req.file.filename })
        await newSubject.save()
        res.redirect("/subjects")
    }
    catch (error) {
        console.log("Subject Added Failure!", error)
        res.redirect("/subjects/add")
    }
}


const renderSubjectListing = async (req, res) => {
    let currentPage = req.query?.page ?? 1

    const text = req.query.search
    let searchQuery = {}
    if (text && text?.trim().length > 0) {
        const regex = new RegExp(text.trim(), 'i');
        searchQuery = {
            $or: [
                { title: { $regex: regex } },
                { linktoTheCall: { $regex: regex } }
            ]
        };
    }

    const subjectCount = await Subjects.find(searchQuery).countDocuments()


    if ((currentPage && isNaN(currentPage)) || currentPage < 1 || (subjectCount > 0 && currentPage > subjectCount)) {
        console.log("Redirecting due to invalid currentPage");
        currentPage = 1
        res.redirect("/subjects")
        return
    }

    const skipOffset = ((currentPage - 1) * RECORD_PER_PAGE)

    const subjects = await Subjects.find(searchQuery).skip(skipOffset).limit(RECORD_PER_PAGE)

    const totalPages = Math.ceil(subjectCount / RECORD_PER_PAGE)
    res.render("subject-list.njk", { subjects, totalPages, currentPage, text })
}

const renderAddSubject = async (req, res) => {
    res.render("add-subject.njk")
}

const renderMain = async (req, res) => {
    res.render("main.njk")
}

const renderAbout = async (req, res) => {
    res.render("about.njk")
}


module.exports = {
    renderSubjectListing,
    renderAddSubject,
    renderMain,
    renderAbout,
    addSubjectPostAction,
    multerStorage,
}