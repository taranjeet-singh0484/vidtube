import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}`)
        console.log("Mongo DB is connected Now!! DB host: "+connectionInstance.connection.host); 
    } catch (error) {
        console.log(`Mongo DB connection error !! ${error}`); 
        process.exit(1);
    }
}

export default connectDB