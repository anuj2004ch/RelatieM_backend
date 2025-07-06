import express from "express";
import { login, logout, signup, onboard,checkUsername,requestOtp } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router=express.Router();


router.post("/signup",signup);
router.post("/request-otp",requestOtp);
router.get("/check-username/:username",checkUsername);
router.post("/login",login);
router.post("/logout",logout);
router.post("/onboarding",protectRoute,onboard);
router.get("/me",protectRoute,(req,res)=>{
    // console.log(req.user.id);
    // console.log(req.user._id.toString());
    res.status(200).json({success:true,user:req.user});
});


export default router;