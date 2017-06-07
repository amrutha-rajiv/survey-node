let BullhornData = require('../models/BullhornData');
var survey = require('../survey_data');
// Twilio Credentials 
var twilioCreds = require('../twilio_creds');

//require the Twilio module and create a REST client 
var client = require('twilio')(twilioCreds.accountSid, twilioCreds.authToken); 
// Handle SMS submissions
module.exports = function(request, response) {

    let data = request.body;
    console.log('post data', data);
    if (data.jobSubmission && ['New Lead', 'Job Response', 'Web Response'].indexOf(data.jobSubmission.status) > -1 ) {
        data.mobile = `+1${data.candidate.mobile}`;
        // data.questions = survey.questions;//TODO: get this from the post body
        data.questions = getTypedQuestions(data.questions);
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
    } else {
        response.send('Invalid submission!');
    }
};

function getTypedQuestions(questions) {
    return questions.map(question => {
       if (question.syncToField) {
           let field = survey.fields.find(field => field.label === question.syncToField);
           if (field) {
               question = Object.assign(question, field);
           } else {
               question.type = 'string';            
           }
       } else {
           question.type = 'string';
       }
       return question;
    });
}

function getFirstQuestion(data) {
    if (!data.jobOrder.clientCorporation) {
        data.jobOrder.clientCorporation = {
            id: 103489 ,
            name: "Rivers Consulting"
        };
    }
    return `Hi, ${data.candidate.name}! 
    Thank you for applying for the position of ${data.jobOrder && data.jobOrder.title || ''} at ${data.jobOrder.clientCorporation.name}. Please answer a few questions for our records.
    ${(data.questions && data.questions[0] && data.questions[0].question) || 'We have no questions for you, Byee!'}`;
}