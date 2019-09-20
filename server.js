// Start Voice Bot Server
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;
const cors = require('cors');
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
const router = express.Router();
app.use('/api', router);
app.listen(port);
console.log('Voice NPS Engine v1 is Online! At http://localhost:' + port);

// Connect to DB
const pg = require('pg');
pg.defaults.ssl = true;
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});
    
// Twilio webhook to process user input
router.get('/n', (req, res) => {
    console.log(req.query);
    realJourney(req.query['u'],req.query['p'], (callback) => {
        res.json(callback);
    })
});

// API to clear ephemeral memory
router.get('/m', (req, res) => {
    if (req.query['key'] == 'abc123') {
        memoryMagnet = {};
        res.json("Memory Cleared");
    } else {
        res.json("Unauthorised");
    }
});

// Start ephemeral memory
let memoryMagnet = {};


// save into memory
const pushToMemoryMagnet = (u, p, a, r) => {
    let memoryNugget = {
        'p' : p,
        'a' : a,
        'r' : r
    };
    memoryMagnet[u] = memoryNugget;
    // save to static DB
    let saveData = "insert into events(timestamp,data,msisdn) values('NOW', $1, $2)";
    let saveValues = [JSON.stringify(memoryNugget), u];
    pool.query(saveData, saveValues, (err, res) => {
        if (err == null) {
            console.log("Save Data Success");
        } else {
            console.log(err);
        }
    });
    console.log(memoryMagnet);
};

// run through conversational journey
const async = require('async');
const natural = require('natural');
const TfIdf = natural.TfIdf;
const tfidf = new TfIdf();

const realJourney = (u, p, cb) => {
    // check if user has started a journey before
    async.waterfall([
        (callback) => { // set memory
            if (!memoryMagnet[u]) {
                pushToMemoryMagnet(u, p, 0);
            } else {
                if (p == 'START') {
                    memoryMagnet[u]['a'] = 0;
                }
            };
            callback(null);
        },
        (callback) => {
            let stage = memoryMagnet[u]['a'];
            switch (stage) {
                case 0:
                    cb(nar (u, p, 0, ''));
                    break;
                case 1:
                    intro_router(u, p, (cbb) => {
                        cb(cbb);
                    });
                    break;
                case 2:
                case 2.1:
                case 2.2:
                case 2.8:
                    nps_router(u, p, (cbb) => {
                        cb(cbb);
                    });
                    break;
                case 6:
                case 7:
                case 8:
                    feedback_router(u, p, (cbb) => {
                        cb(cbb);
                    });
                    break;
                case 'clarify':
                    cb(nar (u, p, 1, ''));
                    break;
                default:
                    cb(nar (u, p, 0, ''));
            }
            callback(null);
        },
    ], (err) => {
        if(err) {
            console.log("Sorry, but there's an error");
        };
    });
};

const narrative = require('./narrative.json');

const nar = (u, p, a, r) => {
    pushToMemoryMagnet(u, p, a, r);
    switch (a) { // set some dynamic rules if needed
        case 0:
            memoryMagnet[u]['a'] = 1;
            return(
                {
                    'response' : narrative[a]
                }
            );           
        case 2.8:
            let t_response = Object.assign({}, narrative[a]);
            t_response['say'] = t_response['say'] + memoryMagnet[u]['r'];
            return(
                {
                    'response' : t_response
                }
            );
        default:
            return(
                {
                    'response' : narrative[a]
                }
            );
    };
};

// Conversational Algos

const getMax = object => {
    return Object.keys(object).filter(x => {
         return object[x] == Math.max.apply(
            null, 
            Object.values(object)
        );
   });
};

const intro_router = (u, p, cb) => {
    let output = searchAlgo(p);
    if (output) {
        // single match
        switch (output['id']) {
            case 'positive':
                cb(nar (u, p, 2, ''));
                break;
            case 'negative':
                cb(nar (u, p, 3, ''));
                break;
            case 'reschedule':
                cb(nar (u, p, 4, ''));
                break;
            case 'interupt':
                cb(nar (u, p, 1, ''));
                break;
        };
    } else {
        // multi match
        cb(nar (u, p, 'clarify', ''));
    };
};

const natN = require('natural-number');
const natural_number = new natN({ lang:'en' });

const nps_router = (u, p, cb) => {
    // get response and check if valid
    p = p.replace(/ I /ig, '');
    if (p == '11') { // Hack - for some reason the natural-number library doesn't accept 11!!
        p = '12'
    }
    console.log("Received: " + p + " Step: " + memoryMagnet[u]['a'])
    switch (memoryMagnet[u]['a']) {
        case 2:
        case 2.1:
        case 2.2: 
            // get result, save in memory and confirm result
            natural_number.parse(p, false, (parsed) => {
                let rating = parsed['numbers']['numerals'].pop();
                if (rating >= 0 && rating <= 10) {
                    cb(nar (u, p, 2.8, rating));
                } else {
                    cb(nar (u, p, 2.1, rating));
                };
            });
            break;
        case 2.8:
            let output = searchAlgo(p);
            let rating = memoryMagnet[u]['r'];
            if (output) {
                // single match
                switch (output['id']) {
                    case 'positive':
                        // launch second set of questions to get them to give further feedback
                        switch (rating) {
                            case 0:
                            case 1:
                            case 2:
                            case 3:
                            case 4:
                            case 5:
                            case 6:
                                console.log("Detractor");
                                cb(nar (u, p, 6, rating));
                                break;
                            case 7:
                            case 8:
                                console.log("Neutral");
                                cb(nar (u, p, 7, rating));
                                break;
                            case 9:
                            case 10:
                                console.log("Promoter");
                                cb(nar (u, p, 8, rating));
                                break;
                        }
                        break;
                    case 'negative':
                        cb(nar (u, p, 2.2, rating));
                        break;
                };
            } else {
                // multi match
                cb(nar (u, p, 2.2, rating));
            };
            break;
        default:
            cb(nar (u, p, 2.1, 10));
    };
};

const feedback_router = (u, p, cb) => {
    cb(nar (u, p, 'end', memoryMagnet[u]['r']));
};

// training playground

const MiniSearch = require('minisearch');
const searchAlgo = (p) => {
    const training_data = [
        {
            id: 'positive',
            text: "yes, yeah, ok, affirmative, amen, fine, good, okay, true, yea, all right, aye, beyond a doubt, by all means, certainly, definitely, even so, exactly, gladly, good enough, granted, indubitably, just so, most assuredly, naturally, of course, positively, precisely, sure thing, surely, undoubtedly, unquestionably, very well, willingly, without fail, yep, yep, yeah, yes, sure, ok, go ahead, continue, do it, proceed, ya ,yea, no problem, can, quick, fast, faster, I have only 5 mins, try, okay, now",
        },
        {
            id: 'negative',
            text: "no ,no time, not interested, don't call me, away, stop, don't like, annoying, irritating, irritated, troublesome, pissed, interrupt, spam, don't think, don't bother, crazy, no, nay, nope, not, nix, never, not"
        },
        {
            id: 'reschedule',
            text: "meeting, busy, not free, call me after, after working hours, driving, appointment, overseas, after"
        },
        {
            id: 'interupt',
            text: "who is this, Who are you, what is this for , could you explain further, again, what did you say, don't understand, elaborate, more, not clear , repeat, why are you calling me, how long, what, do you mean"
        }
      ];
       
      let miniSearch = new MiniSearch({ fields: ['text'], storeFields: ['id'] });
       
      // Index all documents
      miniSearch.addAll(training_data);
       
      // Search with default options
      let results = miniSearch.search(p);
      return(results[0]);
};