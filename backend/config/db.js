const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGO_URI is missing. Check your .env/.env.temp file.");
    process.exit(1);
  }

  const maxRetries = 5;
  let attempt = 0;

  mongoose.connection.on("connected", () => {
    console.log("✅ MongoDB Connected Successfully");
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️ MongoDB disconnected. Mongoose will try to reconnect.");
  });
  mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB runtime error:", err.message);
  });

  while (attempt < maxRetries) {
    try {
      attempt += 1;
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 20,
        minPoolSize: 2,
        retryWrites: true,
      });
      return;
    } catch (error) {
      console.error(`❌ MongoDB connection attempt ${attempt}/${maxRetries} failed:`, error.message);
      if (attempt >= maxRetries) {
        console.error("❌ Exhausted MongoDB retry attempts. Exiting.");
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
};

module.exports = connectDB;
