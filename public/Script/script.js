// Event Listeners
document.querySelector("#password_toggle").addEventListener("click", (e) => {
  togglePassWordVisibility();
});

//Functions
function togglePassWordVisibility() {
  var x = document.getElementById("password");
  var y = document.getElementById("confirm-password");
  if (y) {

    if (y.type === "password") {
      y.type = "text";
    }
    else {
      y.type = "password";
    }

  }


  if (x.type === "password") {
    x.type = "text";
  }
  else {
    x.type = "password";
  }
}