'use strict';

var connection = new Postmonger.Session();
var payload = {};

// Brand Compliance Configuration
const SMS_PREFIX = "PSM Alert: ";
const SMS_SUFFIX = " Reply HELP for help, STOP to end. Msg frq varies. Msg&Data Rates May Apply. Questions? Call us at 1-800-998-7715";

// Internal link placeholder inserted into the textarea
const LINK_PLACEHOLDER = "[LINK]";

$(window).ready(onRender);

// ─────────────────────────────────────────────
//  INITIALIZATION
// ─────────────────────────────────────────────
function onRender() {
    connection.trigger('ready');
    connection.on('initActivity', initialize);
    connection.on('clickedNext', save);

    // Real-time character calculation
    $('#smsMessage').on('input', calculateSmsMetrics);

    // Recalculate when user types / pastes a new URL
    $('#linkUrl').on('input', function () {
        updateLinkPreview();
        calculateSmsMetrics();
    });

    // Insert link placeholder at cursor position
    $('#insertLinkBtn').on('click', insertLinkAtCursor);

    // Remove all link placeholders
    $('#removeLinkBtn').on('click', removeLink);
}

// ─────────────────────────────────────────────
//  SFMC: Load previously saved configuration
// ─────────────────────────────────────────────
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

        // Routing fields
        if (inArguments.flowSid)     $('#flowSid').val(inArguments.flowSid);
        if (inArguments.twilioFrom)  $('#twilioFrom').val(inArguments.twilioFrom);
        if (inArguments.phoneNumber) $('#phoneNumberField').val(inArguments.phoneNumber);

        // Restore saved message body (which may contain [LINK] placeholder)
        if (inArguments.param_smsBody) {
            $('#smsMessage').val(inArguments.param_smsBody);
        }

        // Restore saved URL
        if (inArguments.param_linkUrl) {
            $('#linkUrl').val(inArguments.param_linkUrl);
        }

        // Restore saved link label
        if (inArguments.param_linkLabel) {
            $('#linkLabel').val(inArguments.param_linkLabel);
        }
    }

    // Refresh all UI states after restoring values
    updateLinkStatus();
    updateLinkPreview();
    calculateSmsMetrics();
}

// ─────────────────────────────────────────────
//  LINK: Insert [LINK] at cursor position
// ─────────────────────────────────────────────
function insertLinkAtCursor() {
    var urlValue = $('#linkUrl').val().trim();

    if (!urlValue) {
        alert('Please enter a destination URL before inserting.');
        return;
    }

    if (!isValidUrl(urlValue)) {
        alert('Please enter a valid URL (e.g. https://yourwebsite.com).');
        return;
    }

    var textarea = document.getElementById('smsMessage');
    var startPos = textarea.selectionStart;
    var endPos   = textarea.selectionEnd;
    var currentText = textarea.value;

    // Prevent inserting duplicate placeholders
    if (currentText.indexOf(LINK_PLACEHOLDER) !== -1) {
        alert('A link placeholder [LINK] is already present in your message.\nRemove it first before inserting a new one.');
        return;
    }

    // Build the new message with placeholder injected at cursor
    var newText = currentText.substring(0, startPos) + " " + LINK_PLACEHOLDER + " " + currentText.substring(endPos);
    textarea.value = newText.trim();

    // Move cursor right after the inserted placeholder
    var newCursorPos = startPos + LINK_PLACEHOLDER.length + 2;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();

    // Sync jQuery val
    $('#smsMessage').val(textarea.value);

    updateLinkStatus();
    calculateSmsMetrics();
}

// ─────────────────────────────────────────────
//  LINK: Remove [LINK] from message body
// ─────────────────────────────────────────────
function removeLink() {
    var currentText = $('#smsMessage').val();
    var cleaned = currentText.replace(/\s*\[LINK\]\s*/g, ' ').trim();
    $('#smsMessage').val(cleaned);

    updateLinkStatus();
    calculateSmsMetrics();
}

// ─────────────────────────────────────────────
//  LINK: Update sidebar status badge
// ─────────────────────────────────────────────
function updateLinkStatus() {
    var messageBody = $('#smsMessage').val();
    var hasPlaceholder = messageBody.indexOf(LINK_PLACEHOLDER) !== -1;
    var badge = $('#linkStatusBadge');
    var removeBtn = $('#removeLinkBtn');

    if (hasPlaceholder) {
        badge.text('Active').removeClass('link-status-missing').addClass('link-status-active');
        removeBtn.show();
    } else {
        badge.text('Not Added').removeClass('link-status-active').addClass('link-status-missing');
        removeBtn.hide();
    }
}

// ─────────────────────────────────────────────
//  LINK: Show or hide URL preview label
// ─────────────────────────────────────────────
function updateLinkPreview() {
    var urlValue = $('#linkUrl').val().trim();
    var previewLabel = $('#linkUrlPreview');

    if (urlValue && isValidUrl(urlValue)) {
        previewLabel.text('🔗 ' + urlValue).show();
        $('#linkCharCount').text(urlValue.length).css('color', '#0176d3');
    } else {
        previewLabel.hide();
        $('#linkCharCount').text('0').css('color', '#0176d3');
    }
}

// ─────────────────────────────────────────────
//  SMS METRICS: Real-time character calculation
// ─────────────────────────────────────────────
function calculateSmsMetrics() {
    var rawBody  = $('#smsMessage').val() || "";
    var linkUrl  = $('#linkUrl').val().trim();

    // Replace [LINK] placeholder with the actual URL when calculating total length
    var resolvedBody = rawBody;
    if (rawBody.indexOf(LINK_PLACEHOLDER) !== -1 && linkUrl && isValidUrl(linkUrl)) {
        resolvedBody = rawBody.replace(LINK_PLACEHOLDER, linkUrl);
    } else if (rawBody.indexOf(LINK_PLACEHOLDER) !== -1 && !linkUrl) {
        // If placeholder exists but no URL, count the placeholder literally
        resolvedBody = rawBody;
    }

    // Build the final full message string
    var compiledMessage = SMS_PREFIX + resolvedBody + SMS_SUFFIX;

    // Character counts
    var userCount  = rawBody.length;
    var linkCount  = (rawBody.indexOf(LINK_PLACEHOLDER) !== -1 && linkUrl) ? linkUrl.length : 0;
    var totalCount = compiledMessage.length;

    // GSM-7 Segmentation Logic
    // Single SMS = max 160 chars
    // Concatenated SMS = 153 chars per segment (7 chars used for UDH headers)
    var segments = totalCount <= 160 ? 1 : Math.ceil(totalCount / 153);

    // Update counter badges
    $('#userCharCount').text(userCount);
    $('#linkCharCount').text(linkCount);
    $('#totalCharCount').text(totalCount);
    $('#smsSegments').text(segments);

    // Update segment badge label
    var segBadge = $('#segmentBadge');
    segBadge.text(segments + (segments === 1 ? ' Segment' : ' Segments'));

    // Update status message
    var warningEl = $('#alertWarning');
    if (totalCount === 0) {
        warningEl.text('Start typing your message.').css('color', '#747474');
        segBadge.removeClass('link-status-missing').addClass('link-status-active');
    } else if (totalCount <= 160) {
        warningEl
            .text('✅ Fits comfortably in 1 standard SMS (' + totalCount + ' / 160 characters).')
            .css('color', '#2e844a');
        segBadge.removeClass('link-status-missing').addClass('link-status-active');
    } else {
        warningEl
            .text('⚠️ Exceeds 160 characters. Sent as ' + segments + ' concatenated segments (' + totalCount + ' total chars).')
            .css('color', '#fe5c36');
        segBadge.removeClass('link-status-active').addClass('link-status-missing');
    }

    // Update live preview
    renderPreview(resolvedBody, rawBody, linkUrl);

    // Keep link status badge in sync
    updateLinkStatus();
    updateLinkPreview();
}

// ─────────────────────────────────────────────
//  PREVIEW: Render outbound message preview box
// ─────────────────────────────────────────────
function renderPreview(resolvedBody, rawBody, linkUrl) {
    var previewEl = $('#previewText');
    var displayBody;

    if (rawBody.trim() === '') {
        displayBody = '[Type your message above]';
    } else if (rawBody.indexOf(LINK_PLACEHOLDER) !== -1 && linkUrl && isValidUrl(linkUrl)) {
        // Show fully resolved message with real URL
        displayBody = resolvedBody;
    } else if (rawBody.indexOf(LINK_PLACEHOLDER) !== -1 && !linkUrl) {
        // Highlight that URL is still missing
        displayBody = rawBody.replace(LINK_PLACEHOLDER, '[ ⚠️ URL NOT ENTERED YET ]');
    } else {
        displayBody = rawBody;
    }

    previewEl.text(SMS_PREFIX + displayBody + SMS_SUFFIX);
}

// ─────────────────────────────────────────────
//  VALIDATION: Simple URL format check
// ─────────────────────────────────────────────
function isValidUrl(string) {
    try {
        var url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

// ─────────────────────────────────────────────
//  SFMC: Save & send configuration to Journey
// ─────────────────────────────────────────────
function save() {
    var flowSid      = $('#flowSid').val().trim();
    var twilioFrom   = $('#twilioFrom').val().trim();
    var phoneNumber  = $('#phoneNumberField').val().trim();
    var userSmsBody  = $('#smsMessage').val().trim();
    var linkUrl      = $('#linkUrl').val().trim();
    var linkLabel    = $('#linkLabel').val().trim();

    // Required field validation
    if (!flowSid || !twilioFrom || !phoneNumber) {
        alert('Please complete all required Connection & Routing fields.');
        connection.trigger('ready');
        return;
    }

    if (!userSmsBody) {
        alert('Please type your SMS message body before saving.');
        connection.trigger('ready');
        return;
    }

    // If [LINK] placeholder is present, a valid URL must be provided
    if (userSmsBody.indexOf(LINK_PLACEHOLDER) !== -1) {
        if (!linkUrl) {
            alert('Your message contains a [LINK] placeholder but no URL has been entered.\nPlease enter a destination URL or remove the [LINK] placeholder.');
            connection.trigger('ready');
            return;
        }
        if (!isValidUrl(linkUrl)) {
            alert('The URL you entered is not valid.\nIt must start with https:// or http://');
            connection.trigger('ready');
            return;
        }
    }

    // Build the resolved body (replace [LINK] with actual URL)
    var resolvedBody = userSmsBody;
    if (linkUrl && isValidUrl(linkUrl)) {
        resolvedBody = userSmsBody.replace(LINK_PLACEHOLDER, linkUrl);
    }

    // Build the final compiled message to send to Twilio
    var fullSmsMessage = SMS_PREFIX + resolvedBody + SMS_SUFFIX;

    // Build SFMC inArguments (flat structure for SFMC merge tag parser)
    var inArgs = {
        "flowSid"              : flowSid,
        "twilioFrom"           : twilioFrom,
        "phoneNumber"          : phoneNumber,
        "param_smsBody"        : userSmsBody,      // Raw body including [LINK] placeholder (for re-editing later)
        "param_resolvedBody"   : resolvedBody,     // Body with real URL substituted
        "param_fullSmsMessage" : fullSmsMessage,   // Final message with prefix + resolved body + suffix
        "param_linkUrl"        : linkUrl,           // The destination URL on its own (for Twilio tracking)
        "param_linkLabel"      : linkLabel          // Optional reference label
    };

    payload['arguments'].execute.inArguments = [ inArgs ];
    payload['metaData'].isConfigured = true;

    connection.trigger('updateActivity', payload);
}
