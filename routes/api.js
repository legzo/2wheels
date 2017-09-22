let express = require('express');
let router = express.Router();
let request = require('request');
var rp = require('request-promise');
let colors = require('colors');
var perfy = require('perfy');
var logger = require('./logger');
var config = require('./config.json');

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
  return rp(`https://www.strava.com/api/v3/activities/${id}?access_token=${config.access_token}`)
  .then(function(body) {
    
    let activity = JSON.parse(body);

    let segmentEfforts = activity.segment_efforts;

    let efforts = [];
    
        for (var i = 0; i < segmentEfforts.length; i++) {
          let segmentEffort = segmentEfforts[i];
    
          efforts.push({
            id: segmentEffort.id,
            name: segmentEffort.name,
            time: segmentEffort.elapsed_time
          });
        }

    return new Promise(function(resolve) { 
        resolve(efforts);
    });
  })
  .catch(function (err) {
    logger.error('activities could not be fetched'.red, err);
  });  
}

var getActivities = function() {
  return rp('https://www.strava.com/api/v3/activities?access_token=' + config.access_token)
  .then(function(body) {
    
    let activities = JSON.parse(body);
    let results = [];

    for (var i = 0; i < activities.length; i++) {
      let activity = activities[i];

      results.push({
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
