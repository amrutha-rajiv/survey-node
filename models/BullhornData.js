let mongoose = require('mongoose');

let ClientCorporationSchema = new mongoose.Schema({
    id: Number,
    name: String
});

let CandidateSchema = new mongoose.Schema({
    id: Number,
    name: String,
    mobile: String
});

let JobSubmissionSchema = new mongoose.Schema({
    id: Number,
    status: String
});

let JobOrderSchema = new mongoose.Schema({
    id: Number,
    title: String,
    clientCorporation: ClientCorporationSchema,
    questions: [mongoose.Schema.Types.Mixed]    
});

// Define survey response model schema
let BullhornDataSchema = new mongoose.Schema({
    questions: [mongoose.Schema.Types.Mixed],
    mobile: String,
    jobOrder: JobOrderSchema,
    candidate: CandidateSchema,
    jobSubmission: JobSubmissionSchema,
     // status of the participant's current survey response
    complete: {
        type: Boolean,
        default: false
    }
});

// Export model
delete mongoose.models.BullhornData
delete mongoose.modelSchemas.BullhornData
let BullhornData = mongoose.model('BullhornData', BullhornDataSchema);
module.exports = BullhornData;
