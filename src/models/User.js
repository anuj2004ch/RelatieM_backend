import mongoose from "mongoose";
import bcrypt from "bcryptjs";
const defaultProfilePic = "https://res.cloudinary.com/dxgwesvuc/image/upload/v1751127315/307ce493-b254-4b2d-8ba4-d12c080d6651_vudgtw.jpg"
const userSchema=new mongoose.Schema({
    fullName:{
        type:String,
        required:true
    },
    username:{
        type:String,
        required:true,
        unique:true
    },
    
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true,
        minlength:6
    },
    bio:{
        type:String,
        default:""
    },
    profilePic:{
        type:String,
        default:defaultProfilePic
    },
 
   
    
    
    location:{
        type:String,
        default:""
    },
    isOnboarded:{
        type:Boolean,
        default:false
    },
    friends:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:"User"
        }
    ]


},{timestamps:true});
userSchema.pre("save",async function(next){
    if(!this.isModified("password")) return next();
    try{
        const salt=await bcrypt.genSalt(10);
        this.password=await bcrypt.hash(this.password,salt);
        next();
    }
    catch(error){
        next(error);
    }
})

userSchema.methods.matchPassword=async function(password){
    return await bcrypt.compare(password,this.password);
}



const User=mongoose.model("User",userSchema);


export default User;
