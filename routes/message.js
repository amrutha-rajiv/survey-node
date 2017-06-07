var MessagingResponse = require('twilio').twiml.MessagingResponse;
var SurveyResponse = require('../models/SurveyResponse');
var BullhornData = require('../models/BullhornData');
var survey = require('../survey_data');
var bullhornCreds = require('../bullhorn_creds');
var req = require('request');
// Handle SMS submissions
module.exports = function(request, response) {
    console.log('message body', request.body);
    var phone = request.body.From;
    var input = request.body.Body;
    var bullhornDataDoc = {};
    var fileInfo;
    if (request.body.MediaUrl0 && request.body.MediaContentType0) {
        fileInfo = {
            url: request.body.MediaUrl0,
            type: request.body.MediaContentType0
        };
        console.log('fileinfo', fileInfo);
    }
    // respond with message TwiML content
    function respond(message) {
        var twiml = new MessagingResponse();
        twiml.message(message);
        response.type('text/xml');
        response.send(twiml.toString());
    }
    BullhornData.findOne({
        mobile: phone,
        complete: false
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
                        fileInfo: fileInfo,
                        survey: survey
                    }, handleNextQuestion);
                });
            } else {
                // After the first message, start processing input
                SurveyResponse.advanceSurvey({
                    phone: phone,
                    input: input,
                    fileInfo: fileInfo,
                    survey: survey
                }, handleNextQuestion);
            }
        });

    }); 

    // Ask the next question based on the current index
    function handleNextQuestion(err, surveyResponse, questionIndex, overrideResponseMessage='') {
        var question = survey[questionIndex];
        var responseMessage = '';
        let candidateName = 'Jane';
        let jobTitle = 'Software Engineer';
        let companyName = 'Blizzard Entertainment';

        if (err || !surveyResponse) {
            return respond('Terribly sorry, but an error has occurred. '
                + 'Please retry your message.');
        }

        if (overrideResponseMessage !== '') {
            return respond(overrideResponseMessage);
        }

        if ( questionIndex > 0 && surveyResponse) {
            let prevQuestion = bullhornDataDoc.questions && bullhornDataDoc.questions[questionIndex-1];
            if(prevQuestion && prevQuestion.failAnswer && 
                surveyResponse.responses[questionIndex-1] && surveyResponse.responses[questionIndex-1].rawInput &&
                prevQuestion.failAnswer.toLowerCase() === surveyResponse.responses[questionIndex-1].rawInput.toLowerCase()) {
                bullhornDataDoc.complete = true;
                bullhornDataDoc.save(function(err) {
                    if (err) {
                        console.log('error saving bullhornDataDoc!', err);
                    } else {
                       rejectCandidate(surveyResponse);
                    }
                    return respond('New phone, who dis?');   
                });
            }
        }

        // If question is null, we're done!
        if (!question) {
            bullhornDataDoc.complete = true;
            bullhornDataDoc.save(function(err) {
                if (err) {
                    console.log('error saving bullhornDataDoc!', err);
                } else {
                    addNoteToBullhorn(surveyResponse);
                    updateCandidate(surveyResponse);
                    addFile(surveyResponse);
                }
                return respond('Thank you for answering our questions. Goodbye!');            
            });
        } else {
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
    }

    function addNoteToBullhorn(surveyResponse, rejected=false) {
        if (bullhornDataDoc.candidate && bullhornDataDoc.jobOrder) {
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
        
    }

    function addFile(surveyResponse) {
        if (surveyResponse.fileUrl && surveyResponse.fileType && bullhornDataDoc && bullhornDataDoc.candidate) {
            let url = `${bullhornCreds.restUrl}file/Candidate/${bullhornDataDoc.candidate.id}?BhRestToken=${bullhornCreds.token}`;
            let postData = {
                name: 'License Image',
                contentType: surveyResponse.fileType,
                type: 'License',
                description: '',
                fileContent: surveyResponse.fileUrl,
                fileType: 'LICENSE',
                isExternal: 1,
                externalID : 'Portfolio'
            };
            console.log('file url, postData', url, postData);
            req({
                method: 'PUT',
                body: postData,
                json: true,
                url: url
            },
            function (error, response, body) {
                if (error) {
                return console.error('PUT failed:', error);
                }
                console.log('File upload successful!  Server responded with:', body);
            });
        }
        
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
        if (bullhornDataDoc && bullhornDataDoc.candidate) {
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
    }

    function getCommentsFromSurvey(surveyResponse, rejected) {
        let sentences = [];
        surveyResponse.responses && surveyResponse.responses.forEach((res, i) => {
            sentences.push(`Question: ${bullhornDataDoc && bullhornDataDoc.questions && bullhornDataDoc.questions[i] && bullhornDataDoc.questions[i].question}`);
            sentences.push(`Answer: ${res.rawInput}`);
        });
        if (rejected) {
            sentences.push('This candidate failed the pre-screen.')
        }
        return sentences.join('\n');
    }
};
