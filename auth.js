// auth.js (modular SDK)

import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js';

// Initialize Firebase Authentication (using the app object created in your index.html or other JavaScript file)
const auth = getAuth();

// Sign-Up functionality
document.getElementById('signUpBtn').addEventListener('click', function() {
  const email = document.getElementById('signUpEmail').value;
  const password = document.getElementById('signUpPassword').value;

  createUserWithEmailAndPassword(auth, email, password)
    .then(userCredential => {
      const user = userCredential.user;
      console.log("User signed up: ", user);
      alert('Sign Up Successful!');
    })
    .catch(error => {
      console.error("Error: ", error.message);
      alert(error.message);
    });
});

// Login functionality
document.getElementById('loginBtn').addEventListener('click', function() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  signInWithEmailAndPassword(auth, email, password)
    .then(userCredential => {
      const user = userCredential.user;
      console.log("User logged in: ", user);
      displayUserInfo(user);
    })
    .catch(error => {
      console.error("Error: ", error.message);
      alert(error.message);
    });
});

// Display logged-in user info
function displayUserInfo(user) {
  document.getElementById('userName').innerText = user.displayName || user.email;
  document.getElementById('signUpForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('userInfo').style.display = 'block';
}

// Logout functionality
document.getElementById('logOutBtn').addEventListener('click', function() {
  signOut(auth)
    .then(() => {
      console.log("User logged out");
      document.getElementById('userInfo').style.display = 'none';
      document.getElementById('signUpForm').style.display = 'block';
      document.getElementById('loginForm').style.display = 'block';
    })
    .catch(error => {
      console.error("Error logging out: ", error);
    });
});
