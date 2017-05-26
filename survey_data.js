// Hard coded survey questions
module.exports = {
    questions: [
        {
            question: 'Are you able to provide the proof of right to work in the US?',
            // type: 'boolean'
            shouldSync: 'No',
            failAnswer: 'No'
        },
        {
            question: 'Are you at least 21 years old?',
            // type: 'boolean'
             shouldSync: 'No'
        },
        {
            question: 'Do you have a Commercial Driver\'s Licence?',
            // type: 'boolean'
             shouldSync: 'No'
        },
        {
            question: 'How many years of commerical truck driving experience do you have?',
            // type: 'number'
            shouldSync: 'Yes',
            syncToField: 'Years Experience'
        },
        {
            question: 'When is the earliest date you can start working?',
            // type: 'date'
            shouldSync: 'Yes',
            syncToField: 'Date Available'
        }
    ],
    fields: [
        {
            label: 'First Name',
            type: 'string',
            name: 'firstName'
        },
        {
            label: 'Authorized to Work in the US',
            type: 'boolean',
            name: 'workAuthorized'
        },
        {
            label: 'Years Experience',
            type: 'number',
            name: 'experience'
        },
        {
            label: 'Date Available',
            type: 'date',
            name: 'dateAvailable'
        }
    ]
};