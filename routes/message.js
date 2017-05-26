var MessagingResponse = require('twilio').twiml.MessagingResponse;
var SurveyResponse = require('../models/SurveyResponse');
var BullhornData = require('../models/BullhornData');
var survey = require('../survey_data');
var bullhornCreds = require('../bullhorn_creds');
var req = require('request');
// Handle SMS submissions
module.exports = function(request, response) {
    // console.log('message body', request.body);
    var phone = request.body.From;
    var input = request.body.Body;
    var bullhornDataDoc = {};
    // respond with message TwiML content
    function respond(message) {
        var twiml = new MessagingResponse();
        twiml.message(message);
        response.type('text/xml');
        response.send(twiml.toString());
    }

    BullhornData.findOne({
        mobile: phone
    }, function(err, doc){
        if (doc){
            survey = doc.questions;
            bullhornDataDoc = doc;
        }
        // Check if there are any responses for the current number in an incomplete
        // survey response
        SurveyResponse.findOne({
            phone: phone,
            complete: false
        }, function(err, doc) {
            if (!doc) {
                var newSurvey = new SurveyResponse({
                    phone: phone
                });
                newSurvey.save(function(err, doc) {
                    // Skip the input and just ask the second question
                    //handleNextQuestion(err, doc, 1);
                    SurveyResponse.advanceSurvey({
                        phone: phone,
                        input: input,
                        survey: survey
                    }, handleNextQuestion);
                });
            } else {
                // After the first message, start processing input
                SurveyResponse.advanceSurvey({
                    phone: phone,
                    input: input,
                    survey: survey
                }, handleNextQuestion);
            }
        });

    }); 

    // Ask the next question based on the current index
    function handleNextQuestion(err, surveyResponse, questionIndex) {
        var question = survey[questionIndex];
        var responseMessage = '';
        let candidateName = 'Jane';
        let jobTitle = 'Software Engineer';
        let companyName = 'Blizzard Entertainment';

        if (err || !surveyResponse) {
            return respond('Terribly sorry, but an error has occurred. '
                + 'Please retry your message.');
        }

        if ( questionIndex > 0 && surveyResponse) {
            let prevQuestion = bullhornDataDoc.questions[questionIndex-1];
            if(prevQuestion && prevQuestion.failAnswer && 
                surveyResponse.responses[questionIndex-1] && surveyResponse.responses[questionIndex-1].rawInput &&
                prevQuestion.failAnswer.toLowerCase() === surveyResponse.responses[questionIndex-1].rawInput.toLowerCase()) {
                rejectCandidate(surveyResponse);
                return respond('New phone, who dis?');
            }
        }

        // If question is null, we're done!
        if (!question) {
            addNoteToBullhorn(surveyResponse);
            updateCandidate(surveyResponse);
            return respond('Thank you for answering our questions. Goodbye!');
        }

        // Add a greeting if this is the first question
        if (questionIndex === 0) {
            responseMessage = `Hi, ${candidateName}! Thank you for applying for the position of ${jobTitle} at ${companyName}. Please answer a few questions for our records.`;
        }

        // Add question text
        responseMessage += question.question;

        // Add question instructions for special types
        if (question.type === 'boolean') {
            responseMessage += ' Type "yes" or "no".';
        } else if (question.type === 'number') {
            responseMessage += ' Please reply with a number (1, 2, 3).';
        } else if (question.type === 'date') {
            responseMessage += ' Please reply in the following format: MM/DD/YYYY.';
        }

        // reply with message
        respond(responseMessage);
    }

    function addNoteToBullhorn(surveyResponse, rejected=false) {
        let url = `${bullhornCreds.restUrl}entity/Note?BhRestToken=${bullhornCreds.token}`;
        let note = {
            comments: getCommentsFromSurvey(surveyResponse, rejected),
            personReference: {
                id: bullhornDataDoc.candidate.id
            },
            jobOrders: {
                add: [bullhornDataDoc.jobOrder.id]
            },
            action: 'Pre-Screen'
        };
        console.log('url & note',url,note);
        req({
            method: 'PUT',
            body: note,
            json: true,
            url: url
        },
        function (error, response, body) {
            if (error) {
            return console.error('PUT failed:', error);
            }
            console.log('Note addition successful!  Server responded with:', body);
        });
    }

    function rejectCandidate(surveyResponse) {
        addNoteToBullhorn(surveyResponse, true);
        let url = `${bullhornCreds.restUrl}entity/JobSubmission/${bullhornDataDoc.jobSubmission.id}?BhRestToken=${bullhornCreds.token}`;
        let postData = {
            status: 'Rejected'
        };
        console.log('url & postData',url,postData);
        req({
            method: 'POST',
            body: postData,
            json: true,
            url: url
        },
        function (error, response, body) {
            if (error) {
            return console.error('PUT failed:', error);
            }
            console.log('JobSubmission update successful!  Server responded with:', body);
        });
    }
    

    function updateCandidate(surveyResponse) {
        let url = `${bullhornCreds.restUrl}entity/Candidate/${bullhornDataDoc.candidate.id}?BhRestToken=${bullhornCreds.token}`;
        let postData = {};
        bullhornDataDoc.questions.forEach( (question, i) => {
            let response = surveyResponse.responses[i];
            if (response && question.syncToField && question.name ) {
                postData[question.name] = response.answer;
            }
        });
        console.log('candidate url, postData', url, postData);
        req({
            method: 'POST',
            body: postData,
            json: true,
            url: url
        },
        function (error, response, body) {
            if (error) {
            return console.error('POST failed:', error);
            }
            console.log('Candidate update successful!  Server responded with:', body);
        });
    }

    function getCommentsFromSurvey(surveyResponse, rejected) {
        let sentences = [];
        surveyResponse.responses.forEach((res, i) => {
            sentences.push(`Question: ${bullhornDataDoc.questions[i].question}`);
            sentences.push(`Answer: ${res.rawInput}`);
        });
        if (rejected) {
            sentences.push('This candidate failed the pre-screen.')
        }
        return sentences.join('\n');
    }
};
