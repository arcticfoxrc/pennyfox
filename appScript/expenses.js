/// <reference path="functions.js" />
/* eslint-disable */
// noinspection JSUnresolvedReference
// noinspection SpellCheckingInspection
// noinspection JSUnusedGlobalSymbols
// noinspection JDuplicatedCode
// noinspection JSUnresolvedReference


/*
Copyright (C) 2025 <arcticfoxrc> <arcticfoxrc@gmail.com>

This program is free software; you can redistribute it and/or modify it
under the terms of the GNU General Public License as published by the
Free Software Foundation; version 3 of the License.

This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details, or get a copy at
<https://www.gnu.org/licenses/gpl-3.0.txt>.
*/


/**
 * Processes Gmail messages to extract expense data and store it in a database.
 */
async function myExpenseFunction() {

    const Config = "config";
    const LastGmailId = "lastGmailId";
    const VendorTag = "vendorTag";

    // usually returns last 100 mails
    let res = Gmail.Users.Messages.list('me');
    let mailIdList = res.messages.map((res) => res.id);

    const accessToken = ScriptApp.getOAuthToken();

    // console.log(mailIdList);

    const vendorTag = getAllDoc(VendorTag, accessToken);


    let lastMailId;

    mailIdList = mailIdList.reverse();

    let res_doc = getOneDoc(Config, LastGmailId, accessToken);
    let mailId;

    if (res_doc) {
        mailId = res_doc.value;
    } else {
        mailId = "";
    }

    console.log("Last mail id ", mailId);

    let lastMailIdIndex = mailIdList.indexOf(mailId);
    mailIdList = mailIdList.slice(lastMailIdIndex + 1);
    console.log("Pending mail id list ", mailIdList);

    // return;

    for (const mailIndex in mailIdList) {
        let mailId = mailIdList[mailIndex];
        res = Gmail.Users.Messages.get('me', mailId);

        let snippet = res.snippet;
        let expense = null;
        let type = '';
        let cost;
        let vendor;

        console.log("Email snippet ", snippet.substring(0,150));

        // continue;

        if (snippet.includes('E-mandate')) {
            console.log('-> E-mandate mail');
        } else if (snippet.includes('debited from your HDFC Bank Credit Card ending')) {

            // const CREDIT_CARD_MSG = Dear Customer, Greetings from HDFC Bank! Rs.782.88 is debited from your HDFC Bank
            // Credit Card ending 5667 towards TechMash Solutions Pri on 10 Aug, 2025 at 12:21:54. If you did not authorize this

            type = 'Credit card'
            const creditCardCostRegex = /Rs\b\W\b.+ is debited/g; // 'Rs 24.00 at'
            const creditCardVendorRegex = /towards\s(.*?)\son/; // 'towards MEDPLUS KONNENA AGRAHA on 09-02'


            console.log('-> snippet: ', snippet);
            console.log('-> snippet: cost ', snippet.match(creditCardCostRegex));
            console.log('-> snippet: vendor ', snippet.match(creditCardVendorRegex));


            cost = snippet.match(creditCardCostRegex)[0].replace('Rs.', '').replace(' is debited', '');
            vendor = snippet.match(creditCardVendorRegex)[0].replace('towards ', '').replace(' on', '');


            expense = getExpense(Number(res.internalDate), 'credit', mailId);
            expense.costType = 'debit';

        } else if (snippet.includes('Your UPI transaction')) {


            if (snippet.includes('successfully credited')) {

                // const UPI_MSG_CREDIT = 'Dear Customer, Rs.85.00 is successfully credited to your account \
                // **1811 by VPA aayushXYZ@okaxis AYUSH SHARMA on 09-02-25. Your UPI \
                // transaction reference number is 5048888888. Thank you for';

                type = 'UPI Credit';

                const upiCreditCostRegex = /Rs\b\W\b.+ is successfully/g; // 'Rs.85.00 is successfully'
                const upiCreditVendorRegex = /VPA\s(.*?)\son/; // 'VPA aayushXYZ@okaxis AYUSH SHARMA on 09-02'

                snippet = snippet.replace('Rs. ', 'Rs.');
                console.log('-> snippet: ', snippet);
                console.log('-> snippet: cost ', snippet.match(upiCreditCostRegex));
                console.log('-> snippet: vendor ', snippet.match(upiCreditVendorRegex));

                cost = snippet.match(upiCreditCostRegex)[0].replace('Rs.', '').replace(' is successfully', '');
                vendor = snippet.match(upiCreditVendorRegex)[0].replace('VPA ', '').replace(' on','');

                expense = getExpense(Number(res.internalDate), 'upi', mailId);
                expense.costType = 'credit';

            } else {


                // const UPI_MSG_DEBIT = 'Dear Customer, Rs.10.00 has been debited from account **1811 \
                // to VPA yash-1@okicici YASH R ABC on 09-02-25.\
                // Your UPI transaction reference number is 5048888888. If you did not'

                type = 'UPI Debit';

                const upiDebitCostRegex = /Rs\b\W\b.+ has been/g; // 'Rs.11.00 has been'
                const upiDebitVendorRegex = /VPA\s(.*?)\son/; // 'VPA yash-1@okicici YASH R ABC on 10-02'

                console.log('-> snippet: ', snippet);
                console.log('-> snippet: cost ', snippet.match(upiDebitCostRegex));
                console.log('-> snippet: vendor ', snippet.match(upiDebitVendorRegex));

                cost = snippet.match(upiDebitCostRegex)[0].replace('Rs.', '').replace(' has been', '');
                vendor = snippet.match(upiDebitVendorRegex)[0].replace('VPA ', '').replace(' on', '');

                expense = getExpense(Number(res.internalDate), 'upi', mailId);
                expense.costType = 'debit';
            }

        }

        if (expense !== null) {

            expense.cost = Number(cost)
            expense.vendor = vendor.toUpperCase().substring(0,50);

            const obj = vendorTag.find(({vendor}) => expense.vendor === vendor);

            if (obj) {
                expense.tag = obj.tag;
            }

            // await addExpense(expense, accessToken);

            console.log('-> ', type, ' cost: ', expense.cost);
            console.log('-> ', type, ' vendor: ', expense.vendor);
            console.log('-> ', type, ' expense: ', expense);
        }


        lastMailId = mailId;

    }


    if (lastMailId) {
        console.log('Post execution last mail id ', lastMailId);
        setOneDoc("config", "lastGmailId", lastMailId, accessToken);
    }


}


/**
 * Creates an expense object with default values.
 */
const getExpense = (date, type, mailId) => {
    return {
        cost: 0, costType: 'debit', vendor: null, tag: null, type, date, modifiedDate: date, user: 'xyz', mailId
    };
}


/**
 * Handles GET requests to the web app.
 * This function is triggered when the web app accesses AppScript.
 */
function doGet() {
    Logger.log("doGet function called.");
    myExpenseFunction().then(() => Logger.log("executed expense function"));

    // Return a ContentService response with the email and a 200 OK status
    return ContentService.createTextOutput("Started function")
        .setMimeType(ContentService.MimeType.TEXT);
}
