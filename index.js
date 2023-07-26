const express = require("express");
const app = express();
const mongoose = require("mongoose");
const twilio = require("twilio");
const port = 5000;
const TWILIO_ACCOUNT_SID = "AC8168d97ccd3eaed85dc1b37b0ecf277e";
const TWILIO_AUTH_TOKEN = "133ede36eccb09e1117153f4e5a0e2d1";
const TWILIO_PHONE_NUMBER = "+18064509910";
const shortid = require("shortid");
const multer = require("multer");
const path = require("path");

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/user-auth-api", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));

// Create a User schema
const userSchema = new mongoose.Schema(
  {
    iamThe: String,
    dob: String,
    motherTongue: {
      type: String,
      enum: ["Hindi", "English", "Other"],
    },
    religion: {
      type: String,
      enum: ["Hindu", "Jain", "Other"],
    },
    location: {
      type: String,
    },
    maritalStatus: String,
    caste: String,
    height: String,
    birthStar: String,
    disable: {
      type: Boolean,
    },
    education: {
      type: String,
      enum: ["B.e", "Btech", "Other"],
    },
    job: {
      type: String,
      enum: ["Software Developer", "Backend Developer", "Other"],
    },
    bio: String,
    food: {
      type: String,
      enum: ["Starter", "Fried", "Chinese", "Desert", "Other"],
    },
    drinking: {
      type: String,
      enum: ["Drink", "Mocktel", "MineraL Water", "Other"],
    },
    smoking: {
      type: String,
      enum: ["Cigrette", "Hukka", "Other"],
    },
    interestAndHobbies: [String],
    referralCode: {
      type: String,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    referrals: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    firstName: String,
    lastName: String,
    email: String,
    phoneNumber: String,
    photos: {
      type: Array,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);
const User = mongoose.model("User", userSchema);

const otpSchema = new mongoose.Schema({
  otp: String,
});
const Otp = mongoose.model("Otp", otpSchema);

// Express middleware
app.use(express.json());


// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "E:multiformdata");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Check if file is an image or a video
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only image and video files are allowed!"), false);
  }
};

// Configure multer upload
const upload = multer({ storage: storage, fileFilter: fileFilter });

// Generate OTP
function generateOTP() {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

// Send OTP via Twilio
async function sendOTP(phoneNumber, otp) {
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN); // Initialize Twilio client here
  try {
    await client.messages.create({
      body: `Your OTP is ${otp}`,
      from: TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });
    console.log("OTP sent successfully");
  } catch (error) {
    console.error("Failed to send OTP:", error);
  }
}

app.post("/sendOtp", async (req, res) => {
  const { phoneNumber } = req.body;

  // Generate and save OTP
  const otp = generateOTP();
  const userOtp = new Otp({ otp });
  await userOtp.save();

  // Send OTP
  sendOTP(phoneNumber, otp);

  res.json({ message: "OTP sent for verification", otp: otp });
});

app.post("/otpVerification", async (req, res) => {
  const { otp } = req.body;

  // Find user by email and OTP
  const UserOtp = await Otp.findOne({ otp: otp });
  console.log("UserOtp", UserOtp);
  if (!UserOtp) {
    res.status(401).json({ message: "Invalid OTP" });
  } else {
    res.json({ message: "verification successful" });
  }
});

// API routes
app.post("/register", upload.array("photos", 5) ,async (req, res) => {
  try {
    // const { name, email, referralCode } = req.body;
    // Check if the referral code is valid (if provided)
    const photos = req.files.map((file) => file.path);
    let referredBy = null;
    if (req.body.referralCode) {
      referredBy = await User.findOne({ referralCode: req.body.referralCode });
      console.log("referredBy", referredBy)
      if (!referredBy) {
        return res.status(404).json({ error: "Invalid referral code" });
      }
    }

    // Generate a unique referral code for the new user
    const generatedReferralCode = shortid.generate().toUpperCase();

    // Create the new user
    const newUser = new User({
      ...req.body,
      referralCode: generatedReferralCode,
      referredBy: referredBy ? referredBy._id : null,
      photos: photos
    });

    await newUser.save();

    // If the user was referred, update the referrer's list of referrals
    if (referredBy) {
      await User.findByIdAndUpdate(referredBy._id, {
        $push: { referrals: newUser._id },
      });
    }

    res
      .status(201)
      .json({ message: "User registered successfully", user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

// Get Request
app.get("/", (req, res) => {
  return res.send("Hello World");
});
