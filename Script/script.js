// Event Listeners
document.querySelector("#password_toggle").addEventListener("click", (e) => {
  togglePassWordVisibility();
});

//Functions
function togglePassWordVisibility() {
    var x = document.getElementById("password");
    if (x.type === "password") {
      x.type = "text";
    } 
    else {
      x.type = "password";
    }
}