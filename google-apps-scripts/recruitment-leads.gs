// Paste this into Google Apps Script (Extensions → Apps Script) on your Recruitment Leads sheet
// Then Deploy → New deployment → Web app → Execute as: Me, Access: Anyone

var CALENDLY_URL = 'https://calendly.com/jason-ng-edg/consultation-with-jason-ng';

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  // Set up headers if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Source', 'Name', 'Phone', 'Email', 'Current Status', 'Notes', 'Status']);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
  }

  // Build notes from available fields
  var notes = [];
  if (data.interest) notes.push(data.interest);
  if (data.enneagram_type) notes.push('Enneagram: Type ' + data.enneagram_type + ' — ' + (data.type_name || ''));

  var name = data.name || '';
  var email = data.email || '';
  var phone = data.phone || '';

  sheet.appendRow([
    new Date(),
    data.source || 'unknown',
    name,
    phone,
    email,
    data.status || '',
    notes.join(' | '),
    'New'
  ]);

  // Send automated email to lead
  if (email) {
    var firstName = name.split(' ')[0] || 'there';
    var isEnneagram = data.source === 'enneagram';
    var subject = isEnneagram
      ? 'Your Enneagram results — next steps with Dream Planners'
      : 'Your career conversation with Dream Planners Group';

    var body = 'Hi ' + firstName + ',\n\n';

    if (isEnneagram && data.enneagram_type) {
      body += 'I saw you completed the Enneagram assessment — you\'re a Type ' + data.enneagram_type + ' (' + (data.type_name || '') + '). Really interesting result.\n\n'
        + 'Your full profile goes much deeper than what\'s shown on the page — I\'d love to walk you through your core motivations, how your type performs under pressure, and whether a career with Dream Planners could be a great fit for you.\n\n'
        + 'Let\'s find a time to chat:\n';
    } else {
      body += 'Thanks for your interest in joining Dream Planners Group — I\'d love to have an honest conversation with you about what a career in financial advisory could look like for you.\n\n'
        + 'No pressure at all — just a 30-minute call to get to know each other and see if it\'s a good fit.\n\n'
        + 'You can pick a time here:\n';
    }

    body += CALENDLY_URL + '\n\n'
      + 'Looking forward to connecting with you.\n\n'
      + 'Warm regards,\n'
      + 'Jason Ng\n'
      + 'Dream Planners Group | Great Eastern Financial Advisers\n'
      + 'Phone: +65 8649 5495';

    try {
      GmailApp.sendEmail(email, subject, body);
    } catch(err) {
      Logger.log('Email failed: ' + err);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
