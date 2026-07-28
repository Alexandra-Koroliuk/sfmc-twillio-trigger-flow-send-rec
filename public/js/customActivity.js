'use strict';

var connection = new Postmonger.Session();
var payload = {};

$(window).ready(onRender);

function onRender() {
    connection.trigger('ready');
    connection.on('initActivity', initialize);
    connection.on('clickedNext', save);
}

function initialize(data) {
    if (data) {
        payload = data;
    }
    
    var hasInArguments = Boolean(
        payload['arguments'] &&
        payload['arguments'].execute &&
        payload['arguments'].execute.inArguments &&
        payload['arguments'].execute.inArguments.length > 0
    );

    if (hasInArguments) {
        var inArguments = payload['arguments'].execute.inArguments[0];

        // 1. Set simple input fields
        if (inArguments.flowSid) $('#flowSid').val(inArguments.flowSid);
        if (inArguments.twilioFrom) $('#twilioFrom').val(inArguments.twilioFrom);
        if (inArguments.phoneNumber) $('#phoneNumberField').val(inArguments.phoneNumber);

        // 2. Unpack flattened dynamic parameters back into JSON representation
        var reconstructedParams = {};
        Object.keys(inArguments).forEach(function(key) {
            if (key.indexOf('param_') === 0) {
                var cleanKey = key.replace('param_', '');
                reconstructedParams[cleanKey] = inArguments[key];
            }
        });

        if (Object.keys(reconstructedParams).length > 0) {
            $('#customParams').val(JSON.stringify(reconstructedParams, null, 2));
        }
    }
}

function save() {
    var flowSid = $('#flowSid').val().trim();
    var twilioFrom = $('#twilioFrom').val().trim();
    var phoneNumber = $('#phoneNumberField').val().trim();
    var customParamsRaw = $('#customParams').val().trim();

    if (!flowSid || !twilioFrom || !phoneNumber) {
        alert('Please complete all required fields.');
        connection.trigger('ready');
        return;
    }

    var customParams = {};
    if (customParamsRaw) {
        try {
            customParams = JSON.parse(customParamsRaw);
        } catch (e) {
            alert('Parameters must be a valid JSON object.');
            connection.trigger('ready');
            return;
        }
    }

    // Prepare execution Arguments (Flat Structure)
    var inArgs = {
        "flowSid": flowSid,
        "twilioFrom": twilioFrom,
        "phoneNumber": phoneNumber
    };

    // Flatten keys into inArgs to force SFMC parsing engine to resolve dynamic values
    Object.keys(customParams).forEach(function(key) {
        inArgs['param_' + key] = customParams[key];
    });

    payload['arguments'].execute.inArguments = [ inArgs ];
    payload['metaData'].isConfigured = true;

    // Send the updated configuration back to Journey Builder
    connection.trigger('updateActivity', payload);
}
