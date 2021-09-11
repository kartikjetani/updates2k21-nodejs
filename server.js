const express = require('express');
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 5000;
const cors = require("cors");
const { MongoClient, } = require('mongodb');
const bodyParser = require("body-parser");
const auth = require("./middleware/auth");
const bcrypt  = require('bcrypt');
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: ['http://127.0.0.1:5500', "http://localhost:3000", "http://localhost:3001"]
}));


const uri = process.env.MONGO_URI
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

client.connect(err => {
  if (err) {
    console.log(err);
  }

  app.get("/", (req, res) => {
    res.send("Hello from server.");
  })

  app.post("/login", async (req, res) => {
    let user = await client.db("Registrations").collection("Participants").findOne({
      enrollment: req.body.enrollment
    })

    console.log(req.body);
    if (!user) {
      res.send({ message: "USER_NOT_EXIST" })
      return
    }


    // if (user.password === req.body.password) {
    //   const token = jwt.sign(
    //     { enrollment: user.enrollment },
    //     process.env.TOKEN_KEY
    //   );

    //   res.send({ message: "LOGIN_SUCCESSFUL", token ,enrollment :user.enrollment})
    // } else {
    //   res.send({ message: "INVALID_PASSWORD" })
    // }

    bcrypt.compare(req.body.password, user.password, function (err, result) {
      // console.log(result);
      if (result) {
        const token = jwt.sign(
          { user_id: user.profile_id, mail: req.body.mail, category: user.category },
          process.env.TOKEN_KEY
        );

        res.send({ message: "LOGIN_SUCCESSFUL", token })
      } else {
        res.send({ message: "INVALID_PASSWORD" })
      }
    });
  });

  app.post("/signup", async (req, res) => {
    console.log(req.body);

    const collection = client.db("Registrations").collection("Participants");
    let result = await collection.findOne({
      enrollment: req.body.enrollment
    })

    if (result) {
      res.send({ message: "USER_EXIST", success: false });
      return;
    }

    let encryptedPassword = await bcrypt.hash(req.body.password, 5);

    await collection.insertOne({
      scetid: req.body.scetid,
      enrollment: req.body.enrollment,
      password: encryptedPassword,
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      year: req.body.year,
      dept: req.body.dept,
      shift: req.body.shift,
      phoneno: req.body.phoneno,
      personalid: req.body.personalid,
      participation: []
    })
    res.send({ message: "SUCCESS", success: true });
  })

  // api to register in event
  app.post("/event-register", auth, async (req, res) => {

    console.log(req.body);
    const participants_collection = client.db("Registrations").collection("Participants");


    let result = await participants_collection.findOne({
      enrollment: req.user.enrollment
    });

    if (!result) {
      res.send({ message: "USER_NOT_EXIST" })
      return
    } else if (result.participation.includes(req.body.eventname)) {
      res.send({ message: "ALREADY_REGISTERED" })
      return
    }

    let members = req.body.members || [];

    let membersdoc = await participants_collection.find({ 'enrollment': { $in: members } }).toArray()
      .catch(e => {
        console.log(e);
      });
    // console.log(membersdoc);
    let event_collection
    try {
      event_collection = client.db("Registrations").collection(req.body.eventname);
    } catch {
      console.log("could not find collection");
    }

    await event_collection.insertOne({
      ...result,
      password: "*****",
      members: membersdoc,
      time: new Date().toLocaleString(undefined, { timeZone: 'Asia/Kolkata' })
    }).catch((e) => console.log(e.name))

    participants_collection.updateMany(
      { enrollment: { $in: [...members, req.user.enrollment] } }, { $push: { "participation": req.body.eventname } }
    )

    console.log(req.user.enrollment);
    res.send({ desc: "Registered in " + req.body.eventname, message: "SUCCESS" });
  });


  //api to get user status with enrollment number for particuler event
  app.post("/enrollment-exist", async (req, res) => {
    console.log(req.body);

    const collection = client.db("Registrations").collection("Participants");
    let result = await collection.findOne({
      enrollment: req.body.enrollment
    })

    let eventname = req.body.eventname || "";

    if (!result) {
      res.send({ message: "USER_NOT_EXIST" });
    } else if (result.participation.includes(eventname)) {
      res.status(200).send({ message: "ALREADY_REGISTERED", desc: result.firstname + " has already registered in this event." });
    } else if (result) {
      res.send({ message: "NOT_REGISTERED", desc: "Congrats " + result.firstname + " is available to take part with you." })
    } else {
      res.send({ message: "ERROR" });
    }

  });

});//end client.connect();

app.listen(PORT, () => {
  console.log("server is running on port " + PORT);
})
