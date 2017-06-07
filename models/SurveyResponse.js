var mongoose = require('mongoose');
var moment = require('moment');
// Define survey response model schema
var SurveyResponseSchema = new mongoose.Schema({
    // phone number of participant
    phone: String,
    // status of the participant's current survey response
    complete: {
        type: Boolean,
        default: false
    },
    fileUrl: String,
    fileType: String,
    // record of answers
    responses: [mongoose.Schema.Types.Mixed]
});

// For the given phone number and survey, advance the survey to the next
// question
SurveyResponseSchema.statics.advanceSurvey = function(args, cb) {
    var surveyData = args.survey;
    var phone = args.phone;
    var input = args.input;
    var fileInfo = args.fileInfo;
    var surveyResponse;

    // Find current incomplete survey
    SurveyResponse.findOne({
        phone: phone,
        complete: false
    }, function(err, doc) {
        surveyResponse = doc || new SurveyResponse({
            phone: phone
        });
        processInput();
    });

    // fill in any answer to the current question, and determine next question
    // to ask
    function processInput() {
        // If we have input, use it to answer the current question
        var responseLength = surveyResponse.responses.length
        var currentQuestion = surveyData[responseLength];
        // if there's a problem with the input, we can re-ask the same question
        function reask(overrideResponseMessage='') {
            console.log('reasking')
            cb.call(surveyResponse, null, surveyResponse, responseLength, overrideResponseMessage);
        }
        // If we have no input, ask the current question again
        if (!input && !fileInfo) return reask();

        // Otherwise use the input to answer the current question
        var questionResponse = {};
        if (currentQuestion && currentQuestion.type === 'boolean') {
            // Anything other than '1' or 'yes' is a false
            var isTrue = input === '1' || input.toLowerCase() === 'yes';
            questionResponse.answer = isTrue ? 1 : 0;
        } else if (currentQuestion && currentQuestion.type === 'number') {
            // Try and cast to a Number
            var num = Number(input);
            if (isNaN(num)) {
                // don't update the survey response, return the same question
                return reask();
            } else {
                questionResponse.answer = num;
            }
        } else if (input && input.indexOf('http') === 0) {
            // input is a recording URL
            questionResponse.recordingUrl = input;
        } else if (currentQuestion && currentQuestion.type === 'date') {
            //check date format
            if (!input.match(/\d{2}\/\d{2}\/\d{4}/)) {
                return reask('Please make sure your answer is in this format: MM/DD/YYYY. For example - 07/01/2017');
            }
            let dateVal = moment(input, 'MM/DD/YYYY');
            if (dateVal) {
                questionResponse.answer = dateVal.valueOf();
            }
            console.log('date answer', questionResponse.answer);
        } else if (fileInfo && fileInfo.url) {
            questionResponse.answer = fileInfo.url;
        } else {
            // otherwise store raw value
            questionResponse.answer = input;
        }
        questionResponse.rawInput = input;

        // Save type from question
        questionResponse.type = currentQuestion && currentQuestion.type;
        surveyResponse.responses.push(questionResponse);
        if (fileInfo && fileInfo.url && fileInfo.type) {
            surveyResponse.fileUrl = fileInfo.url;
            surveyResponse.fileType = fileInfo.type;
        }
        // If new responses length is the length of survey, mark as done
        if (surveyResponse.responses.length === surveyData.length) {
            surveyResponse.complete = true;
        }
        console.log('surveyResponse', surveyResponse);
        // Save response
        surveyResponse.save(function(err) {
            if (err) {
                console.log('error saving surveyResponse!', err);
                reask();
            } else {
                console.log('saved');
                cb.call(surveyResponse, err, surveyResponse, responseLength+1);
            }
        });
    }
};

// Export model
delete mongoose.models.SurveyResponse
delete mongoose.modelSchemas.SurveyResponse
var SurveyResponse = mongoose.model('SurveyResponse', SurveyResponseSchema);
module.exports = SurveyResponse;
