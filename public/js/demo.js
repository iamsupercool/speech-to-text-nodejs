/**
 * Copyright 2014 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/*global $:false */

'use strict';

$(document).ready(function() {

  // Only works on Chrome
  if (!$('body').hasClass('chrome')) {
    $('.unsupported-overlay').show();
  }

  // UI
  var micButton = $('.micButton'),
  micText = $('.micText'),
  transcript = $('#text'),
  errorMsg = $('.errorMsg');


  function displayError(error) {
    var message = error;
    try {
      var errorJson = JSON.parse(error);
      message = JSON.stringify(errorJson, null, 2);
    } catch (e) {
      message = error;
    }

    errorMsg.text(message);
    errorMsg.show();
    transcript.hide();
  }

  //Sample audios
  var audio1 = 'audio/sample1.wav',
      audio2 = 'audio/sample2.wav';

  function _error(xhr) {
    $('.loading').hide();
    displayError('Error processing the request, please try again.');
  }

  function getSocket(options, onopen, onmessage, onerror) {
    var model = options.model || 'en-US_BroadbandModel';
    var token = options.token;
    var message = options.message || {'action': 'start'};
    var wsUrl = 'wss://stream-d.watsonplatform.net/speech-to-text-beta/api/v1/recognize?watson-token=' 
      + token 
      + '&model=' + model;
    var socket = new WebSocket(wsUrl);
    socket.onopen = function(evt) {
      console.log('ws opened');
      socket.send(JSON.stringify(message));
      onopen(evt);
    };
    socket.onmessage = function(evt) {
      onmessage(evt);
    };
    socket.onerror = function(evt) {
      onerror(evt);
    };
  }

  function stopSounds() {
    $('.sample2').get(0).pause();
    $('.sample2').get(0).currentTime = 0;
    $('.sample1').get(0).pause();
    $('.sample1').get(0).currentTime = 0;
  }

  $('.audio1').click(function() {
    $('.audio-staged audio').attr('src', audio1);
    stopSounds();
    $('.sample1').get(0).play();
  });

  $('.audio2').click(function() {
    $('.audio-staged audio').attr('src', audio2);
    stopSounds();
    $('.sample2').get(0).play();
  });

  $('.send-api-audio1').click(function() {
    transcriptAudio(audio1);
  });

  $('.send-api-audio2').click(function() {
    transcriptAudio(audio2);
  });

  function showAudioResult(data){
    $('.loading').hide();
    transcript.empty();
    $('<p></p>').appendTo(transcript);
    showResult(data);
  }


  function initFileUpload(socket) {

    function handleFileUploadEvent(evt) {
      console.log('Uploading file');
      var file = evt.dataTransfer.files[0];
      parseFile(file, function(err, chunk) {
        console.log('Handling chunk');
        if (err) {
          console.log('FileReader error', err)
        } else if (chunk) {
          socket.send(chunk);
        } else {
          socket.send(JSON.stringify({'action': 'stop'}));
        }
      });
    }

    var target = $(".file-upload");
    target.on('dragenter', function (e) {
      e.stopPropagation();
      e.preventDefault();
    });

    target.on('dragover', function (e) {
      e.stopPropagation();
      e.preventDefault();
    });

    target.on('drop', function (e) {
      console.log('File dropped');
      e.preventDefault();
      var evt = e.originalEvent;
      // Handle dragged file event
      handleFileUploadEvent(evt);
    });

  }

  function showResult(data) {
    //if there are transcripts
    if (data.results && data.results.length > 0) {

      var text = data.results[0].alternatives[0].transcript || '';

      //if is a partial transcripts
      if (data.results.length === 1 ) {

        //Capitalize first word
        // if final results, append a new paragraph
        if (data.results[0].final){
          console.log('final res:', text);
          baseString += text;
          baseString = baseString.charAt(0).toUpperCase() + baseString.substring(1);
          baseString = baseString.trim() + '.';
          $('#resultsText').val(baseString);
        } else {
          console.log('interimResult res:', text);
          var temp = baseString + text;
          $('#resultsText').val(temp);
        }
      }
    }
  }

  function initSpeech(socket) {

    var mic = new Microphone();

    var running = false;
    var recordButton = document.getElementById("recordButton");
    recordButton.onclick = function(evt) {
      if (running) {
        console.log('stopping mic');
        mic.stop();
        running = false;
      } else {
        console.log('starting mic');
        mic.record();
        running = true;
      }
    };
    var count = 0;
    mic.onAudio = function(blob) {
      // setTimeout(function() {
        socket.send(blob)
      // }, count * 100);
      // count++;
    };


    function onError(err) {
      console.log('audio error: ', err);
    }

  }

  function websocketTest(token) {
    // Test out websocket
    var options = {};
    options.token = token;
    options.message = {
      'action': 'start',
      'content-type': 'audio/l16;rate=16000',
      'interim_results': true,
      'continuous': true,
      'word_confidence': true,
      'timestamps': true,
      'max_alternatives': 3
    };
    getSocket(options, function() {}, function(evt) {
      console.log('ws msg', evt.data);
      var msg = JSON.parse(evt.data);
      if (msg.results) {
        showResult(msg);
      }
    }, function(err) {
      console.log('err', err);
    });
  }

  function callRESTApi(token) {
    var modelUrl = 'https://stream-d.watsonplatform.net/speech-to-text-beta/api/v1/models';
    var sttRequest = new XMLHttpRequest();
    sttRequest.open("GET", modelUrl, true);
    sttRequest.withCredentials = true;
    sttRequest.setRequestHeader('Accept', 'application/json');
    sttRequest.setRequestHeader('X-Watson-Authorization-Token', token);
    sttRequest.onload = function(evt) {
      console.log('STT Models ', sttRequest.responseText);
      // We wait until we've given this request a chance to load and (ideally) set the cookie
      // But we get a net::ERR_CONNECTION_REFUSED, apparantly because no cookie is set
      console.log('models', sttRequest.responseText);
      var response = JSON.parse(sttRequest.responseText);
      response.models.forEach(function(model) {
        $("select#dropdownMenu1").append( $("<option>")
            .val(model.name)
            .html(model.description)
        );
      });
    };
    sttRequest.send();
  }
  // callRESTApi(TOKEN);
  // Make call to API to try and get cookie
  var url = '/token';
  var tokenRequest = new XMLHttpRequest();
  tokenRequest.open("GET", url, true);
  tokenRequest.onload = function(evt) {
    var token = tokenRequest.responseText;
    console.log('Token ', decodeURIComponent(token));
    callRESTApi(token);
    websocketTest(token);
  }

  tokenRequest.send();
  var arr = [{
     "results": [
        {
           "alternatives": [
              {
                 "confidence": 0.7147521376609802, 
                 "transcript": "blah interim "
              }
           ], 
           "final": false
        }
     ], 
     "result_index": 0
  }, {
     "results": [
        {
           "alternatives": [
              {
                 "confidence": 0.7147521376609802, 
                 "transcript": "int ...yes three s. "
              }
           ], 
           "final": false
        }
     ], 
     "result_index": 0
  }, {
     "results": [
        {
           "alternatives": [
              {
                 "confidence": 0.7147521376609802, 
                 "transcript": "yes the one two three s. "
              }
           ], 
           "final": true
        }
     ], 
     "result_index": 0
  }, {
     "results": [
        {
           "alternatives": [
              {
                 "confidence": 0.7147521376609802, 
                 "transcript": "another interim ..."
              }
           ], 
           "final": false
        }
     ], 
     "result_index": 0
  }, {
     "results": [
        {
           "alternatives": [
              {
                 "confidence": 0.7147521376609802, 
                 "transcript": "last one transcript. "
              }
           ], 
           "final": true
        }
     ], 
     "result_index": 0
  }];

  var baseString = '';


  // arr.forEach(function(sample, i) {
  //   console.log('next result');
  //   setTimeout(function() {
  //     if (sample.results) {
  //       showResult(sample);
  //     }
  //   }, i * 1000);
  // });


});

