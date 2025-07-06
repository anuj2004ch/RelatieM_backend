import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { cal } from "../lib/nodemailer.js";

// ✅ Signup
export async function signup(req, res) {
  const { email, password, fullName,username} = req.body;
  console.log(req.body);
  try {
    if (!email || !password || !fullName || !username) {
      return res.status(400).send("All fields are required");
    }
    if (password.length < 6) {
      return res.status(400).send("Password must be at least 6 characters");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).send("Invalid email format");
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { username }] 
    });
    if (existingUser) {
      return res.status(400).send("User with this email or username already exists");
    }

    // const idx = Math.floor(Math.random() * 100) + 1;
    // const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

    const newUser = await User.create({
      fullName,
      username,
      
      email,
      password,
      
    });

    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "7d" }
    );

    res.cookie("jwt", token, {
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", 
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax", 
});


    res.status(201).json({ success: true, user: newUser });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// ✅ Login
export async function login(req, res) {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).send("All fields are required");
    }

    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier } 
      ]
    });
    if (!user) {
      return res.status(401).json({ message: "Invalid email/username or password" });
    }

    const isPasswordCorrect = await user.matchPassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "7d" }
    );

    res.cookie("jwt", token, {
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", 
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax", 
});


    res.status(200).json({ success: true, user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// ✅ Logout
export async function logout(req, res) {
  res.clearCookie("jwt", {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    secure: process.env.NODE_ENV === "production", // Must be true on Render
  });

  res.status(200).json({ success: true, message: "Logout successful" });
}

// ✅ Onboarding
export async function onboard(req, res) {
  try {
    const userId = req.user._id;
    const {
      fullName,
      username,
      bio,
      profilePic, 
    
      location,
    } = req.body;

    if (!fullName || !bio  || !location || !username) {
      return res.status(400).json({
        message: "All fields are required",
        missingFields: [
          !fullName && "fullName",
          !bio && "bio",
          !username && "userName",
          !profilePic && "profilePic",

      
          !location && "location",
        ].filter(Boolean),
      });
    }
   

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        ...req.body,
        isOnboarded: true,
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}
export async function checkUsername(req, res) {
  const { username } = req.params;
  console.log(username);
  try {
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const existingUser = await User.findOne({ username });
    console.log(existingUser);
    if (existingUser) {
      return res.status(200).json({ available: false});
    }

    res.status(200).json({ available: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}


export async function requestOtp(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

 
  const otp = Math.floor(100000 + Math.random() * 900000);
  console.log(email);

  const emailSent = await cal(email, otp);

  if (emailSent) {
    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      otp,
    });
  } else {
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP. Please try again.",
    });
  }
}