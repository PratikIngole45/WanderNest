
const { query } = require('express');
const Listing = require('../models/index.js');
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geoCodingClient = mbxGeocoding({accessToken:mapToken});


// module.exports.index = async (req, res) =>{
//     const allListings = await Listing.find({});
//     res.render("./listings/index.ejs",{allListings });
// }
module.exports.index = async (req, res) => {
  const { q, minPrice, maxPrice, category, sort } = req.query;

  let filter = {};

  if (q) filter.title = new RegExp(q, 'i');

  if (minPrice) filter.price = { ...filter.price, $gte: parseInt(minPrice) };
  if (maxPrice) filter.price = { ...filter.price, $lte: parseInt(maxPrice) };

  if (category) filter.category = category;  // ✅ This is allowed now

  let sortOption = {};
  if (sort === 'priceAsc') sortOption.price = 1;
  if (sort === 'priceDesc') sortOption.price = -1;

//   console.log("FILTER BEING USED:", filter); // ✅ Debug

  try {
    const allListings = await Listing.find(filter).sort(sortOption).populate('owner');
    res.render("./listings/index.ejs", { allListings });
  } catch (e) {
    console.error("ERROR:", e);
    req.flash("error", "Something went wrong.");
    res.redirect("/");
  }
};

module.exports.renderNewForm=(req, res) =>{
    res.render("./listings/new.ejs");
}

module.exports.showListing=async(req, res) =>{
    let {id} = req.params;
    // const listing = await Listing.findById(id).populate({path : "reviews", populate:{path: "author"}}).populate("owner");
    const listing = await Listing.findById(id)
        .populate({ path: "reviews", populate: { path: "author" } })
        .populate("owner");
    if (!listing){
        req.flash("error", "Listing does not exists");
        res.redirect("/listings");
    }
    res.render("./listings/show.ejs",{listing});
}

module.exports.createListing = async(req, res, next) =>{
    let responce = await geoCodingClient
        .forwardGeocode({
            query:req.body.listing.location,
            limit : 1,
        })
        .send();

    let url = req.file.path;
    let filename = req.file.filename;
    let newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.image= {url, filename};

    const savedListing = newListing.geometry = responce.body.features[0].geometry;
    console.log(savedListing);

    await newListing.save();
    console.log(newListing);
    req.flash("success", "New Listing Added Successfully.");
    res.redirect("/listings");
}

module.exports.renderEditForm = async(req, res) =>{
    let {id} = req.params;
    const listing = await Listing.findById(id);
    if (!listing){
        req.flash("error", "Listing does not exists");
        res.redirect("/listings");
    }

    let originalImageUrl = listing.image.url;
    originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");

    res.render("./listings/edit.ejs", {listing, originalImageUrl})
}

module.exports.updateListing = async (req, res) =>{

    let {id} = req.params;
    let listing = await Listing.findByIdAndUpdate(id, {...req.body.listing});

    if(typeof req.file !=="undefined"){
        let url = req.file.path;
        let filename = req.file.filename;
        listing.image = {url, filename};
        await listing.save(); 
    }
    req.flash("success", "Updated Listing Successfully.");
    res.redirect(`/listings/${id}`);
}

module.exports.destroyListing = async(req, res) =>{
    let {id} = req.params;
    let deleteListings = await Listing.findByIdAndDelete(id);
    console.log(deleteListings);
    req.flash("success", "Listing Deleted Successfully.");
    res.redirect("/listings");
}