
const express = require("express");
const session = require("express-session");
const app = express();
const fs = require("fs");
const { JSDOM } = require('jsdom');

app.use("/js", express.static("public/js"));
app.use("/css", express.static("public/css"));
app.use("/img", express.static("public/imgs"));
app.use("/fonts", express.static("public/fonts"));
app.use("/html", express.static("public/html"));
app.use("/media", express.static("public/media"));

app.use(session(
  {
    secret: "extra text that no one will guess",
    name: "FureverHomeSessionID", 
    resave: false,
    saveUninitialized: true
  })
);

app.get("/", function (req, res) {

  if (req.session.loggedIn) {
    res.redirect("/profile");
  } else {

    let doc = fs.readFileSync("./app/html/login.html", "utf8");

    res.set("Server", "FureverHome Engine");
    res.set("X-Powered-By", "FureverHome");
    res.send(doc);
  }
});

app.get("/profile", function (req, res) {

  // check for a session first!
  if (req.session.loggedIn) {

    let profile = fs.readFileSync("./app/html/profile.html", "utf8");
    let profileDOM = new JSDOM(profile);

    profileDOM.window.document.getElementsByTagName("title")[0].innerHTML= req.session.name + "'s Homepage";
    profileDOM.window.document.getElementById("profile_name").innerHTML = "Name: " + req.session.name + " " + req.session.lastName;
    profileDOM.window.document.getElementById("profile_age").innerHTML = "Age: " + req.session.age;
    profileDOM.window.document.getElementById("profile_email").innerHTML = "Email: " + req.session.email;
    profileDOM.window.document.getElementById("profile_favBreed").innerHTML = "Favourite Breed: " + req.session.prefBreed;
    profileDOM.window.document.getElementById("profile_adoptfoster").innerHTML = "Adopt/Foster/Both: " + req.session.adoptFoster;

    const mysql = require("mysql2");
    const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "adopt"
    });
    connection.connect();
    connection.query(
      'SELECT * FROM pets',
      function (error, results, fields) {
        console.log("Results from DB", results, "and the # of records returned", results.length);
        let t1;
        for (let i = 0; i < results.length; i++) {
          let pet = "<tr><td>" + results[i].petName + "</td>";
          pet += "<tr><td>" + results[i].petAge + "</td>";
          pet += "<tr><td>" + results[i].petBreed + "</td>";
          pet += "<tr><td>" + results[i].petGender + "</td>";
          pet += "<tr><td>" + results[i].petWeight + "</td>";
          t1 = pet;
          profileDOM.window.document.getElementById("table"+ [i]).innerHTML = t1;
        }                
        res.set("Server", "FureverHome Engine");
        res.set("X-Powered-By", "FureverHome");
        res.send(profileDOM.serialize());
      }
    );
  } else {
    res.redirect("/");
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/login", function (req, res) {
  res.setHeader("Content-Type", "application/json");

  console.log("What was sent", req.body.email, req.body.password);

  let results = authenticate(req.body.email, req.body.password,
    function (userRecord) {
      if (userRecord == null) {
        res.send({ status: "fail", msg: "User account not found." });
      } else {
        req.session.loggedIn = true;
        req.session.email = userRecord.email;
        req.session.name = userRecord.name;
        req.session.lastName = userRecord.lastName;
        req.session.prefBreed = userRecord.prefBreed;
        req.session.age = userRecord.age;
        req.session.adoptFoster = userRecord.adoptFoster;
        
        req.session.save(function (err) {
        });
        res.send({ status: "success", msg: "Logged in." });
      }
    },

    function (petsRecord) {
      if (petsRecord == null) {
        res.send({ status: "fail", msg: "User account not found." });
      } else {
        req.session.loggedIn = true;
        req.session.petName = petsRecord.petName;
        req.session.petAge = petsRecord.petAge;
        req.session.petBreed = petsRecord.petBreed;
        req.session.petWeight = petsRecord.petWeight;
        req.session.petGender = petsRecord.petGender;

        req.session.save(function (err) {
        });
        res.send({ status: "success", msg: "Logged in." });
      }
    } 
    );
});

app.get("/logout", function (req, res) {

  if (req.session) {
    req.session.destroy(function (error) {
      if (error) {
        res.status(400).send("Unable to log out")
      } else {
        res.redirect("/");
      }
    });
  }
});

function authenticate(email, pwd, callback) {

  const mysql = require("mysql2");
  const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "adopt"
  });
  connection.connect();
  connection.query(
    "SELECT * FROM user WHERE email = ? AND password = ?", [email, pwd],
    function (error, results, fields) {
      console.log("Results from DB", results, "and the # of records returned", results.length);

      if (error) {
        console.log(error);
      }
      if (results.length > 0) {
        return callback(results[0]);
      } else {
        return callback(null);
      }
    }
  );
}

async function init() { 

  const mysql = require("mysql2/promise");
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    multipleStatements: true
  });
  const createDBAndTables = `CREATE DATABASE IF NOT EXISTS adopt;
    use adopt;
    
    CREATE TABLE IF NOT EXISTS user (
    ID int NOT NULL AUTO_INCREMENT,
    name varchar(30),
    lastName varchar(30),
    age varchar(3),
    prefBreed varchar(30),
    adoptFoster varchar(30),
    email varchar(30),
    password varchar(30),
    PRIMARY KEY (ID));
    
    CREATE TABLE IF NOT EXISTS pets (
    ID int NOT NULL AUTO_INCREMENT,
    petName varchar(30),
    petAge varchar(15),
    petBreed varchar(30),
    petWeight varchar(30),
    petGender varchar(30),
    PRIMARY KEY(ID));`;
  await connection.query(createDBAndTables);

  const [rows, fields] = await connection.query("SELECT * FROM user");
  if (rows.length == 0) {
    let userRecords = "insert into user (name, lastName, email, password, age, prefBreed, adoptFoster) values ?";
    let recordValues = [
      ["Jane", "Doe", "jane_doe@bcit.ca", "comp1537", "28", "Bulldog", "Adopt"],
      ["Colleen", "Vu", "colleen_vu@bcit.ca", "comp1537", "24", "Samoyed", "Foster"],
      ["John", "Smith", "john_smith@bcit.ca", "comp1537", "30", "Pomeranian", "Both"]
    ];
    await connection.query(userRecords, [recordValues]);
  }

  const [rows1, fields1] = await connection.query("SELECT * FROM pets");
  if (rows1.length == 0) {

    let petsRecords = "insert into pets (petName, petAge, petWeight, petBreed, petGender) values ?";
    let petsValues = [
      ["Daisy", "4 years old", "55 lbs", "Labrador Terrier Mix", "Male"],
      ["Rubin", "7 years old", "47 lbs", "Doberman Mix", "Female"],
      ["Fish", "2 weeks old", "4 lbs", "Labrador", "Female"],
      ["Cocoa", "1 year old", "12 lbs", "Pomeranian", "Male"],
      ["Tubby", "3 years old", "35 lbs", "Border Collie Mix", "Male"],
      ["Ronnie", "4 years old", "40 lbs", "Shiba Inu Mix", "Male"],
      ["Stinky", "6 years old", "15 lbs", "Shih Tzu", "Female"],
      ["Smelly", "3 years old", "66 lbs", "Labrador Mix", "Male"],
      ["Poopy", "2 years old", "50 lbs", "Siberian Husky", "Female"],
      ["Ladybug", "5 years old", "43 lbs", "Pitbull Terrier Mix", "Female"]
    ];
    await connection.query(petsRecords, [petsValues]);
  }
  console.log("Listening on port " + port + "!");
}

let port = 8000;
app.listen(port, init);