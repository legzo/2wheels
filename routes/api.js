let express = require('express');
let router = express.Router();
let request = require('request');
let rp = require('request-promise');
let colors = require('colors');
let perfy = require('perfy');
let logger = require('./logger');
let config = require('./config.json');

let ROOT_URL = 'https://www.strava.com/api/v3';
let PER_PAGE = 40;

router.get('/refresh', function(req, res) {
  
  let segments = {};
  let queries = [];
  let allEfforts = [];

  getActivities()
  .then((activities) => {
    
    for (var i = 0; i < activities.length; i++) {
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
                segments[effort.id] = [];
              }
        
              segments[effort.id].push(effort.time);
            }
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
  
  getActivity(id)
      .then((result) =>  res.send(result));

});

router.get('/activities', function(req, res) {

  let params = req.query;

  getActivities(params)
    .then((result) =>  res.send(result));

});

var getActivity = function(id) {
  return rp(`${ROOT_URL}/activities/${id}?access_token=${config.access_token}`)
  .then(function(body) {
    
    let activity = JSON.parse(body);

    let segmentEfforts = activity.segment_efforts;

    let efforts = [];
    
    for (var i = 0; i < segmentEfforts.length; i++) {
      let segmentEffort = segmentEfforts[i];

      efforts.push({
        id: segmentEffort.segment.id,
        name: segmentEffort.name,
        time: segmentEffort.elapsed_time
      });
    }

    return new Promise(function(resolve) { 
        resolve(efforts);
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

module.exports = router;
