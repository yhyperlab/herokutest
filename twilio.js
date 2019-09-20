const got = require('got');

exports.handler = function (context, event, callback) {
	const twiml = new Twilio.twiml.VoiceResponse();

    let u = event.Caller;
    if (event.SpeechResult) {
        p = event.SpeechResult;
    } else {
        p = 'START';
    }

	got('https://vb-nps-ned.herokuapp.com/api/n?u=' + u + '&p=' + p).then(response => {
		let botsays = JSON.parse(response.body);
		
		twiml.gather({
			input: 'speech',
// 			timeout: 3,
			profanityFilter: false,
			speechTimeout: 'auto',
			actionOnEmptyResult: true,
			speechModel: 'numbers_and_commands',
			hints: botsays.response.hints
		}).say({voice: 'Polly.Matthew'}, botsays.response.say)
		callback(null, twiml)
	}).catch(err => {
		console.log('Error:', err)
		twiml.say({voice: 'Polly.Matthew'}, 'Sorry, it seems that didn\'t work as well as anticipated');
		twiml.redirect('/spirit-convo'); //** change this */
		callback(null, twiml);
	});
};