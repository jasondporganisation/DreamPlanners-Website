// Paste this into Google Apps Script (Extensions → Apps Script) on your Sales Leads sheet
// Then Deploy → New deployment → Web app → Execute as: Me, Access: Anyone

var CALENDLY_URL = 'https://calendly.com/jason-ng-edg/consultation-with-jason-ng';

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  // Set up headers if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Source', 'Name', 'Phone', 'Email', 'Extra Info', 'Status']);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
  }

  // Handle nested lead object
  var lead = data.lead || {};
  var name = data.name || lead.name || data.parentName || '';
  var phone = data.phone || lead.phone || '';
  var email = data.email || lead.email || '';

  // Collect extra info
  var extras = [];
  if (data.preferred_time) extras.push('Time: ' + data.preferred_time);
  if (data.profile) extras.push('Profile: ' + data.profile);
  if (data.voucher_preference) extras.push('Voucher: ' + data.voucher_preference);
  if (data.parentName) extras.push('Parent: ' + data.parentName);
  if (data.babyName) extras.push('Baby: ' + data.babyName);
  if (data.babyDob) extras.push('Baby DOB: ' + data.babyDob);
  if (data.property_stage) extras.push('Property Stage: ' + data.property_stage);
  if (data.format) extras.push('Format: ' + data.format);
  if (data.lifeStage) extras.push('Life Stage: ' + data.lifeStage);
  if (data.interest) extras.push('Interest: ' + data.interest);
  if (data.results) extras.push('Gap Score: ' + (data.results.score || '') + ', Death Gap: ' + (data.results.deathGap || '') + ', CI Gap: ' + (data.results.ciGap || ''));

  sheet.appendRow([
    new Date(),
    data.source || 'unknown',
    name,
    phone,
    email,
    extras.join(' | '),
    'New'
  ]);

  // Send automated email to lead
  if (email) {
    var firstName = name.split(' ')[0] || 'there';
    var source = data.source || '';
    var subject, intro;

    if (source === 'health-check') {
      subject = 'Re: Your financial health check';
      intro = 'Got your details, thanks for filling that in!\n\n'
        + 'Let\'s get on a quick 15-minute call. I\'ll look through your current coverage with you, flag anything worth paying attention to, and give you my honest take. Very chill, no pressure.\n\n'
        + 'Pick a time that works for you here:\n';
    } else if (source === 'cpf-guide') {
      subject = 'Re: Your CPF review';
      intro = 'Thanks for reading through the CPF guide! Most people I talk to are surprised by how much more they can do with their CPF once they actually look at it properly.\n\n'
        + 'Happy to do a quick 30-minute call and go through your numbers together. I\'ll keep it simple and focus on what actually makes sense for you.\n\n'
        + 'Grab a slot here:\n';
    } else if (source === 'life-stage-checklist') {
      subject = 'Re: Your financial checklist';
      intro = 'Thanks for going through the checklist, hope it was useful!\n\n'
        + 'Everyone\'s situation is a bit different so the checklist is really just a starting point. Happy to hop on a quick call and go through things more closely for you, just to make sure nothing important gets missed.\n\n'
        + 'Pick a time here:\n';
    } else if (source === 'tax-guide') {
      subject = 'Re: Your tax savings';
      intro = 'Thanks for checking out the tax guide! SRS is one of those things a lot of people keep meaning to look into but end up pushing to later in the year.\n\n'
        + 'Happy to jump on a quick call and run through the numbers based on your income. I\'ll show you what you could actually save and whether it makes sense for you to act on it this year.\n\n'
        + 'Book a slot here:\n';
    } else if (source === 'comparison-tool') {
      subject = 'Re: Your insurance comparison';
      intro = 'Thanks for using the comparison tool, glad you are doing your research before deciding anything!\n\n'
        + 'There is quite a bit that does not show up in a side by side comparison. Happy to walk you through the details on a call so you have a clearer picture of what actually fits your situation.\n\n'
        + 'Let\'s find a time to talk:\n';
    } else if (source === 'gap-calculator') {
      subject = 'Re: Your coverage gap report';
      intro = 'Thanks for running through the gap calculator, I have received your results!\n\n'
        + 'There are a few things in there worth talking through. I\'d like to go through the report with you on a call, explain what the gaps mean, and we can figure out together whether it makes sense to do anything about them.\n\n'
        + 'Pick a time here:\n';
    } else {
      subject = 'Re: Dream Planners Group';
      intro = 'Thanks for reaching out, I have got your details!\n\n'
        + 'Would love to have a quick 30-minute chat and answer any questions you have. Very relaxed, no obligation at all.\n\n'
        + 'Pick a time here:\n';
    }

    var body = 'Hi ' + firstName + ',\n\n'
      + intro
      + CALENDLY_URL + '\n\n'
      + 'Looking forward to speaking with you soon.\n\n'
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
