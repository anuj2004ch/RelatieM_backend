import nodemailer from "nodemailer";
import "dotenv/config";
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "",
    pass: process.env.EMAIL_PASS || "",
  },
});


export   const cal = async ({email}, otp) => {
    const receiverEmail = email;
  try {
    const mailOptions = {
      from: '"RelatieM" <testpurpose2004@gmail.com>',
      to: receiverEmail,
      subject: "Your OTP Code",
      text: `Hello,\n\nYour OTP code is: ${otp}.\n\nIf you did not request this, please ignore it.\n\nBest regards,\nAI INTERVIEW PREP`,
      html: `
        <p>Hello,</p>
        <p><strong>Your OTP code is: ${otp}</strong></p>
        <p>If you did not request this, please ignore it.</p>
        <br/>
        <p>Best regards,<br/>RelatieM</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};
