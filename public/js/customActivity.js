'use strict';

var connection = new Postmonger.Session();
var payload = {};

// Hardcoded Brand Compliance Rules
const SMS_PREFIX = "PSM Alert: ";
const SMS_SUFFIX = " Reply HELP for help, STOP to end. Msg frq varies. Msg&Data Rates May Apply. Questions? Call us at 1-800-998-7715";

$(window).ready(onRender);

function onRender() {
    connection.trigger('ready');
    connection.on('initActivity', initialize);
    connection.on('clickedNext', save);

    // Attach keyup event listener to calculate lengths in real-time
    $('#smsMessage').on('input', calculateSmsMetrics);
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

        // Hydrate routing properties
        if (inArguments.flowSid) $('#flowSid').val(inArguments.flowSid);
        if (inArguments.twilioFrom) $('#twilioFrom').val(inArguments.twilioFrom);
        if (inArguments.phoneNumber) $('#phoneNumberField').val(inArguments.phoneNumber);

        // Hydrate saved custom body message
        if (inArguments.param_smsBody) {
            $('#smsMessage').val(inArguments.param_smsBody);
        }
    }

    // Trigger initial calculation on open
    calculateSmsMetrics();
}

function calculateSmsMetrics() {
    const userBody = $('#smsMessage').val() || "";
    const compiledMessage = SMS_PREFIX + userBody + SMS_SUFFIX;

    const userCount = userBody.length;
    const totalCount = compiledMessage.length;

    // Standard GSM-7 segmentation guidelines:
    // If total length is under 160 chars, it's 1 segment.
    // If it exceeds 160, it splits into 153-character segments due to UDH (User Data Headers)
    let segments = 1;
    if (totalCount > 160) {
        segments = Math.ceil(totalCount / 153);
    }

    // Update metrics UI
    $('#userCharCount').text(userCount);
    $('#totalCharCount').text(totalCount);
    $('#smsSegments').text(segments);

    // Update alert indicators
    const warningLabel = $('#alertWarning');
    if (totalCount <= 160) {
        warningLabel.text("Fits comfortably in 1 standard SMS.").css("color", "#2e844a");
    } else {
        warningLabel.text(`⚠️ Warning: Exceeds standard SMS limit. Sent as ${segments} concatenated segments.`).css("color", "#fe5c36");
    }

    // Update real-time preview box
    if (userBody.trim() === "") {
        $('#previewText').text(SMS_PREFIX + "[Type your message above]" + SMS_SUFFIX);
    } else {
        $('#previewText').text(compiledMessage);
    }
}

function save() {
    var flowSid = $('#flowSid').val().trim();
    var twilioFrom = $('#twilioFrom').val().trim();
    var phoneNumber = $('#phoneNumberField').val().trim();
    var userSmsBody = $('#smsMessage').val().trim();

    if (!flowSid || !twilioFrom || !phoneNumber || !userSmsBody) {
        alert('Please complete all required fields and compose your message.');
        connection.trigger('ready');
        return;
    }

    // Create execution Arguments (Flattened structure for SFMC parser)
    var inArgs = {
        "flowSid": flowSid,
        "twilioFrom": twilioFrom,
        "phoneNumber": phoneNumber,
        // Send both raw input AND compiled full text to Twilio Studio Flow
        "param_smsBody": userSmsBody,
        "param_fullSmsMessage": SMS_PREFIX + userSmsBody + SMS_SUFFIX
    };

    payload['arguments'].execute.inArguments = [ inArgs ];
    payload['metaData'].isConfigured = true;

    connection.trigger('updateActivity', payload);
}
