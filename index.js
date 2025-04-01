// DESCRIPTION: QAP3 Database CD Collection. This program will create a database called cdcollection
//              in MongoDB and with use of Thunder or equivalent API client for testing will allow data 
//              to be retieved, added, modified or deleated. See README for instructions.
// AUTHOR: DC Elliott
// DATE: March 31/2025


const express = require('express');
const app = express();
const PORT = 3000;
app.use(express.json());
const mongoose = require('mongoose');
const MONGO_URI ='mongodb://localhost:27017/cdcollection';

Genres = ['RAP', 'POP', 'ROCK', 'COUNTRY', 'DANCE', 'WORLD', 'BLUES', 'JAZZ', 'CLASSICAL']

const collectionSchema = new mongoose.Schema({
  _id: {  // Replace the objectId with a simplier indexing
    type: Number, 
    required: true,
    unique: [true, 'ID already exists']
  },
  title: {
    type: String,
    required: true
  },
  artist: {
    type: String,
    required: true
  },
  genre: {
    type: String,
    uppercase: true,
    required: true,
    validate: { //Added this to create a defined pool of genres
      validator: function(value) {
        return Genres.includes(value);
      },
      message: props => `${props.value} is not a valid genre. Allowed genres are: ${Genres.join(', ')}`
    }

  },
  year: {
    type: Number,
    required: true,
    min: [1000, 'Year must be 4 digits'], //round about way to ensure date is 4 digits. Regex might be better
    max: [9999, 'Year must be 4 digits'] 
  }
}, {versionKey: false // Mongoose puts a v__ in each document, this turns it off

});

const Collection = mongoose.model('Collection', collectionSchema)


// In-memory CD collection
let cds = [
  { _id: 1, title: 'Hybrid Theory', artist: 'Linkin Park', genre: 'ROCK', year: 2000 },
  { _id: 2, title: 'Thriller', artist: 'Michael Jackson', genre: 'POP', year: 1982 },
  { _id: 3, title: 'The Eminem Show', artist: 'Eminem', genre: 'RAP', year: 2002 },
  { _id: 4, title: 'Back in Black', artist: 'AC/DC', genre: 'ROCK', year: 1980 },
  { _id: 5, title: '21', artist: 'Adele', genre: 'BLUES', year: 2011 },
  { _id: 6, title: 'Fearless', artist: 'Taylor Swift', genre: 'COUNTRY', year: 2008 },
  { _id: 7, title: 'Nevermind', artist: 'Nirvana', genre: 'ROCK', year: 1991 },
  { _id: 8, title: 'Future Nostalgia', artist: 'Dua Lipa', genre: 'POP', year: 2020 },
  { _id: 9, title: 'American Idiot', artist: 'Green Day', genre: 'ROCK', year: 2004 },
  { _id: 10, title: 'Good Kid, M.A.A.D City', artist: 'Kendrick Lamar', genre: 'RAP', year: 2012 }
];


async function seedCollection() {  //This will create and populate the collection database in MongoDB with
  try {                            //the array cds above.
      const collectionCount = await Collection.countDocuments();
      if (collectionCount === 0) {
          await Collection.insertMany(cds);
          console.log("Seeded CD collection.");
      }else {
        console.log("Collection already has data, skipping seed.");
      }
  }catch (err) {
      console.error("Error seeding CD collection:", err);
  }
}

// let nextId = (Collection.countDocuments()+1); // Make nextId based on mongodb
// console.log(nextId)


// GET /cds - Return all CDs, or title only, or filters by artist,genre, or before specified year
app.get('/cds', async (request, response) => {
  try {
    const queryFilter = {};
    
    // Filter by artist
    if (request.query.artist) {
      queryFilter.artist = request.query.artist;
    }
    
    // Filter by genre - must convert to uppercase
    if (request.query.genre) {
      const genreParam = request.query.genre.toUpperCase();
      if (!Genres.includes(genreParam)) {
        return response.status(400).json({
          error: `Invalid genre: "${request.query.genre}"`,
          message: `Valid genres are: ${Genres.join(', ')}`
        });
      }
      queryFilter.genre = genreParam;
    }
    
    // Filter before a certain year
    if (request.query.before) {
      const beforeYear = parseInt(request.query.before);
      if (isNaN(beforeYear)) {
        return response.status(400).json({
          error: `Invalid year value: "${request.query.before}"`,
          message: `Year must be a valid number`
        });
      }
      queryFilter.year = { $lt: beforeYear };
    }
    
    //Return titles only
    let titleOnly = null;
    if (request.query.fields === 'title') {
      titleOnly = { title: 1, _id: 0 }; // Return only title field
    } else if (request.query.fields && request.query.fields !== 'title') {
      return response.status(400).json({
        error: `Invalid fields parameter: "${request.query.fields}"`,
        message: `Only "title" is supported as a fields parameter`
      });
    }
    const allCds = await Collection.find(queryFilter, titleOnly);
    if (allCds.length === 0) {
      return response.status(404).json({
        message: 'No CDs found matching the specified criteria'
      });
    }
    
    response.json(allCds);
  } catch (err) {
    response.status(500).json({error: 'Error retrieving collection', details: err.message});
  }
});


// POST /cds - Add a new CD
app.post('/cds', async (request, response) => {
  try {
    const count = await Collection.countDocuments();//This is where countDocuments must be to pick up new additions
    const nextId = count + 1;
    const { title, artist, genre, year } = request.body;
    const newCd = new Collection({ _id: nextId, title, artist, genre, year });
    const savedCd = await newCd.save();
    response.status(201).json(savedCd);
  }catch (err) {
    response.status(400).json({error: `Error adding new CD ${title} to collection.`, details: err.message });
  }
});


// PUT /cds/:id - Update an existing CD
app.put('/cds/:_id', async (request, response) => {
  try {
    const _id = parseInt(request.params._id);
    const { title, artist, genre, year } = request.body;
    const updateData = {};
  if (title) updateData.title = title;
  if (artist) updateData.artist = artist;
  if (genre) updateData.genre = genre;
  if (year) updateData.year = year;

  const updatedCd = await Collection.findByIdAndUpdate(
    _id, 
    updateData, 
    { new: true } // Return the updated document
  );
  if (!updatedCd) {
    return response.status(404).json({ error: `CD with ID ${_id} not found` });
  }
  response.json(updatedCd);
} catch (err) {
  response.status(400).json({ error: `Error updating CD`, details: err.message });
}
});

// DELETE /cds/:id - Delete a CD
app.delete('/cds/:_id', async (request, response) => {
  try{
    const index = parseInt(request.params._id);
    const deletedCd = await Collection.findByIdAndDelete(index);
    if (!deletedCd) {
      return response.status(404).json({ error: `CD with ID ${id} not found` });
    }
    response.json(deletedCd);
  }catch{
    response.status(400).json({ error: `Error deleting CD`});
  }
});

// TODO:
// - Replace in-memory data with a Mongoose model - DONE
// - Replace all CRUD operations with MongoDB queries - DONE
// - Implement query support for filtering and selecting fields - DONE
// - Add proper error checking and validation for inputs and operations- DONE



mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("Successfully connected to MongoDB.");
    return seedCollection();
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("Error establishing connection with MongoDB:", err);
  });



