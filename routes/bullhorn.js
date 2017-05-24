let BullhornData = require('../models/BullhornData');
var survey = require('../survey_data');
// Twilio Credentials 
var twilioCreds = require('../twilio_creds');

//require the Twilio module and create a REST client 
var client = require('twilio')(twilioCreds.accountSid, twilioCreds.authToken); 
// Handle SMS submissions
module.exports = function(request, response) {

    let data = request.body;
    data.questions = survey;
    console.log('body', request.body.candidate);
    //save data
    var newBullhornData = new BullhornData(data);
    newBullhornData.save(function(err, doc) {
        // Ask the first question
        client.messages.create({ 
            to: data.candidate.mobile, 
            from: '+16172076182', 
            body: getFirstQuestion(data)  
        }, function(err, message) {
            console.log(err, message) 
        });
        response.send('Success!');
    });
};

function getFirstQuestion(data) {
    return `Hi, ${data.candidate.name}! 
    Thank you for applying for the position of ${data.jobOrder.title} at ${data.jobOrder.clientCorporation.name}. Please answer a few questions for our records.
    ${data.questions[0].text}`;
}