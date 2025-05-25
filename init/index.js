const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/index.js"); // Ensure correct path


const MONGOOSE_URL = "mongodb://127.0.0.1:27017/wanderlust";   //url to connect with database
//TO call main function
main().then(() =>{
    console.log("Connect to Db.")
}).catch((err) =>{
    console.log(err);
})

async function main(){  //main function 
    await mongoose.connect(MONGOOSE_URL);
}

const initDB = async () =>{
    await Listing.deleteMany({});
    initData.data = initData.data.map((obj) => ({ ...obj, owner: "68203c87dfa4ddb9a7c0ea70" }));
    await Listing.insertMany(initData.data);
    console.log("Data was initialized.");
};
// initDB();


