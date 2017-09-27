let express = require('express');
let router = express.Router();
let request = require('request');
let rp = require('request-promise');
let colors = require('colors');
let perfy = require('perfy');
let logger = require('./logger');
let config = require('./config.json');
let fs = require('fs');

let ROOT_URL = 'https://www.strava.com/api/v3';
let PER_PAGE = 200;
let LIMIT_FOR_REFRESH = 40;

router.get('/refresh', function(req, res) {
  
  let segments = {};
  let queries = [];
  let allEfforts = [];

  getActivities()
  .then((activities) => {
    
    for (var i = 0; i < activities.length ; i++) {
      let activity = activities[i];

      logger.info(`Querying ${activity.name}`);

      queries.push(getActivity(activity.id)
                    .then((efforts) => allEfforts.push.apply(allEfforts, efforts)));      
    }

    perfy.start('all-done');

    Promise.all(queries)
          .then(() => {
            let elapsed = perfy.end('all-done');
            logger.info(`All done in ${elapsed.time}`);

            for (var i = 0; i < allEfforts.length; i++) {
              let effort = allEfforts[i];
              if(segments[effort.id] == undefined) {
                segments[effort.id] = {
                  name: effort.name,
                  efforts: []
                };
              }
        
              segments[effort.id].efforts.push(effort.time);
            }

            let filename = './segments.json';
            fs.writeFile(filename, JSON.stringify(segments, null, 2) , 'utf-8', () => logger.info('Saved to ' + filename));

            res.send(segments);
          })
          .catch((err) => {
            logger.error('activities could not be fetched'.red, err); 
            res.send('💩');
          });
  }); 

});

router.get('/activities/:id', function(req, res) {
  
  let id = req.params.id;

  fs.readFile('./segments.json', 'utf8', (err, data) => {
    if (err) throw err;

    var pastSegments = JSON.parse(data);

    getActivity(id, pastSegments)
      .then((result) =>  res.send(result));
  });

});

router.get('/activities', function(req, res) {

  let params = req.query;

  getActivities(params)
    .then((result) =>  res.send(result));

});

var getActivity = function(id, pastSegments) {
  return rp(`${ROOT_URL}/activities/${id}?access_token=${config.access_token}`)
  .then(function(body) {
    
    let activity = JSON.parse(body);

    let segmentEfforts = activity.segment_efforts;


    let activitySummary = {
      efforts : [],
      summary : []
    };
    
    for (var i = 0; i < segmentEfforts.length; i++) {
      let segmentEffort = segmentEfforts[i];
      let segmentId = segmentEffort.segment.id;

      let segmentEffortSummary = {
        id: segmentId,
        name: segmentEffort.name,
        time: segmentEffort.elapsed_time
      }

      if(pastSegments && pastSegments[segmentId]) {
        let effortsForSegment = pastSegments[segmentId].efforts;
        // efforts[segmentId].maxTime = Math.max(...effortsForSegment);
        // efforts[segmentId].minTime = Math.min(...effortsForSegment);
        // efforts[segmentId].percent = round(percent(effortsForSegment, segmentEffort.elapsed_time));
        // segmentEffortSummary.values = effortsForSegment;
        segmentEffortSummary.percentile = round(percentile(effortsForSegment, segmentEffort.elapsed_time));        
      }

      activitySummary.efforts.push(segmentEffortSummary);
      activitySummary.summary.push(segmentEffortSummary.percentile);
    }

    return new Promise(function(resolve) { 
        resolve(activitySummary);
    });
  })
  .catch(function (err) {
    logger.error('activity could not be fetched'.red, err);
  });  
}

var getActivities = function() {
  return rp(`${ROOT_URL}/activities?per_page=${PER_PAGE}&access_token=${config.access_token}`)
  .then(function(body) {
    
    let activities = JSON.parse(body);
    let results = [];

    logger.info(`Found ${activities.length} results`);

    for (var i = 0; i < activities.length; i++) {
      let activity = activities[i];

      results.push({
        id: activity.id,
        name: activity.name,
        distance: round(activity.distance / 1000),
        averageSpeed: round(msToKmH(activity.average_speed)),
      });
    }

    return new Promise(function(resolve) { 
        resolve(results);
    });
  })
  .catch(function (err) {
    logger.error('activities could not be fetched'.red, err);
  });  
}

let round = function(number) {
  return Math.round(number * 100) / 100;
}

let msToKmH = function(speedInMS) {
  return speedInMS * 60 * 60 / 1000;
}

let percent = function(array, value) {
	let max = Math.max(...array);
	let min = Math.min(...array);
	return 1 - (value - min) / (max - min);
}

let percentile = function(arr, v) {
  if (typeof v !== 'number') throw new TypeError('v must be a number');
  arr = arr.sort((a, b) => a - b);
  for (var i = 0, l = arr.length; i  < l; i++) {
      if (v <= arr[i]) {
          while (i < l && v === arr[i]) i++;
          if (i === 0) return 0;
          if (v !== arr[i-1]) {
              i += (v - arr[i-1]) / (arr[i] - arr[i-1]);
          }
          return i / l;
      }
  }
  return 1;
}

module.exports = router;
