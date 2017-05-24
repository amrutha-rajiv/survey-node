var path = require('path');
var express = require('express');
var morgan = require('morgan');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var config = require('./config');
var voice = require('./routes/voice');
var message = require('./routes/message');
var bullhorn = require('./routes/bullhorn');
var results = require('./routes/results');
var Promise = require('bluebird');

// use node A+ promises
mongoose.Promise = Promise;

// check for connection string
if (!config.mongoUrl) {
  throw new Error('MONGO_URL env variable not set.');
}

var isConn;
// initialize MongoDB connection
if (mongoose.connections.length === 0) {
  mongoose.connect(config.mongoUrl);
} else {
  mongoose.connections.forEach(function(conn) {
    if (!conn.host) {
      isConn = false;
    }
  })

  if (isConn === false) {
    mongoose.connect(config.mongoUrl);
  }
}

// Create Express web app with some useful middleware
var app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(morgan('combined'));

// Twilio Webhook routes
app.post('/voice', voice.interview);
app.post('/voice/:responseId/transcribe/:questionIndex', voice.transcription);
app.post('/message', message);

//Bullhorn Webhook
app.post('/bullhorn', bullhorn);

// Ajax route to aggregate response data for the UI
app.get('/results', results);

module.exports = app;
