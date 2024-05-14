const express = require("express")
const cors = require("cors")
const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(cors())
const nunjucks = require("nunjucks")

nunjucks.configure('views', {
    autoescape: true,
    express: app
});
app.use(express.static("public"))

require("./db")

const userRoutes = require("./routes/user_router")
const subjectRoutes = require("./routes/subject-router")

app.use("/", userRoutes)
app.use("/", subjectRoutes)

app.get("*", (req, res) => {
    // res.render("message.njk", { message: "Not Found" })
    res.redirect("/")
})
app.listen(3000, () => {
    console.log("server running on port 3000")
})

module.exports = app