// Global smooth scrolling for anchor links
document.addEventListener('DOMContentLoaded', function() {
 // Smooth scrolling for anchor links
 document.querySelectorAll('a[href^="#"]').forEach(anchor => {
   anchor.addEventListener('click', function (e) {
     e.preventDefault();
     const target = document.querySelector(this.getAttribute('href'));
     if (target) {
       target.scrollIntoView({
         behavior: 'smooth',
         block: 'start'
       });
     }
   });
 });

 // Enhanced password toggle for all password fields
 document.querySelectorAll('.password-toggle').forEach(toggle => {
   toggle.addEventListener('click', function() {
     const passwordField = document.getElementById(this.dataset.target);
     if (passwordField) {
       const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
       passwordField.setAttribute('type', type);
       
       const icon = this.querySelector('i');
       if (icon) {
         icon.classList.toggle('fa-eye');
         icon.classList.toggle('fa-eye-slash');
       }
     }
   });
 });
});

// Dark/Light Mode Toggle (enhanced for new theme system)
(function() {
 const html = document.documentElement;
 const toggleBtns = document.querySelectorAll('#theme-toggle, #mobile-theme-toggle');
 
 // Check for saved theme or system preference
 const savedTheme = localStorage.getItem('theme') || 'light';
 html.setAttribute('data-theme', savedTheme);
 
 // Update all toggle buttons
 toggleBtns.forEach(btn => {
   btn.textContent = savedTheme === 'light' ? '🌙 Dark' : '☀️ Light';
   btn.setAttribute('aria-label', savedTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
 });
 
 // Toggle function
 function toggleTheme() {
   const currentTheme = html.getAttribute('data-theme');
   const newTheme = currentTheme === 'light' ? 'dark' : 'light';
   
   html.setAttribute('data-theme', newTheme);
   localStorage.setItem('theme', newTheme);
   
   // Update all toggle buttons
   toggleBtns.forEach(btn => {
     btn.textContent = newTheme === 'light' ? '🌙 Dark' : '☀️ Light';
     btn.setAttribute('aria-label', newTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
   });
   
   // Trigger custom event for other components
   document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
 }
 
 // Event listener for all toggle buttons
 toggleBtns.forEach(btn => {
   btn.addEventListener('click', toggleTheme);
 });
 
 // Listen for system preference changes (only if no saved theme)
 window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
   if (!localStorage.getItem('theme')) {
     const systemTheme = e.matches ? 'dark' : 'light';
     html.setAttribute('data-theme', systemTheme);
     
     toggleBtns.forEach(btn => {
       btn.textContent = systemTheme === 'light' ? '🌙 Dark' : '☀️ Light';
       btn.setAttribute('aria-label', systemTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
     });
   }
 });
})();

// Mobile menu responsiveness enhancement
(function() {
 const mobileToggle = document.getElementById('mobile-menu-toggle');
 const mobileMenu = document.getElementById('mobile-menu');
 
 if (mobileToggle && mobileMenu) {
   mobileToggle.addEventListener('click', function() {
     mobileMenu.classList.toggle('hidden');
     const isExpanded = !mobileMenu.classList.contains('hidden');
     mobileToggle.setAttribute('aria-expanded', isExpanded);
     
     // Update icon
     const icon = mobileToggle.querySelector('i');
     if (icon) {
       icon.className = isExpanded ? 'fas fa-times text-xl' : 'fas fa-bars text-xl';
     }
   });
   
   // Close mobile menu when clicking outside
   document.addEventListener('click', function(event) {
     if (!mobileToggle.contains(event.target) && !mobileMenu.contains(event.target)) {
       mobileMenu.classList.add('hidden');
       mobileToggle.setAttribute('aria-expanded', 'false');
       const icon = mobileToggle.querySelector('i');
       if (icon) {
         icon.className = 'fas fa-bars text-xl';
       }
     }
   });
   
   // Close mobile menu on window resize (if desktop)
   window.addEventListener('resize', function() {
     if (window.innerWidth >= 768) {
       mobileMenu.classList.add('hidden');
       mobileToggle.setAttribute('aria-expanded', 'false');
     }
   });
 }
})();

// Form validation enhancement for all forms
(function() {
 document.addEventListener('DOMContentLoaded', function() {
   // Add loading state to all submit buttons
   document.querySelectorAll('form button[type="submit"]').forEach(btn => {
     const form = btn.closest('form');
     if (form) {
       form.addEventListener('submit', function() {
         btn.disabled = true;
         btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';
       });
     }
   });
   
   // Enhance file input previews
   document.querySelectorAll('input[type="file"]').forEach(input => {
     input.addEventListener('change', function() {
       const file = this.files[0];
       const previewId = this.dataset.preview;
       if (file && file.type.startsWith('image/') && previewId) {
         const preview = document.getElementById(previewId);
         if (preview) {
           const reader = new FileReader();
           reader.onload = function(e) {
             preview.src = e.target.result;
             preview.classList.remove('hidden');
           };
           reader.readAsDataURL(file);
         }
       }
     });
   });
 });
})();

// Notification system enhancement for socket notifications
(function() {
 // Listen for theme changes to update notifications
 document.addEventListener('themeChanged', function(e) {
   const notifications = document.querySelectorAll('.notification-toast');
   notifications.forEach(notification => {
     if (e.detail.theme === 'dark') {
       notification.classList.add('dark-theme');
     } else {
       notification.classList.remove('dark-theme');
     }
   });
 });
})();