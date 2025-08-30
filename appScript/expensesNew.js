/*
 * Copyright (C) 2025 Rushikesh <rushikc.dev@gmail.com>
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 3 of the License, or (at your
 * option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details, or get a copy at
 * <https://www.gnu.org/licenses/gpl-3.0.txt>.
 */

/// <reference path="functions.js" />
/* eslint-disable */
// noinspection JSUnresolvedReference
// noinspection SpellCheckingInspection
// noinspection JSUnusedGlobalSymbols
// noinspection JDuplicatedCode
// noinspection JSUnresolvedReference


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
    mailIdList = mailIdList.slice(90);
    // mailIdList = mailIdList.slice(lastMailIdIndex + 1);
    console.log("Pending mail id list ", mailIdList);

    // return;

    // const emailParsingConfig = JSON.parse(UrlFetchApp.fetch(
    //     'https://raw.githubusercontent.com/arcticfoxrc/pennyfox/main/appScript/emailParsingConfig.json'
    // ).getContentText());

    const emailParsingConfig = {
        "v1": {
            "description": "HDFC Bank E-mandate, Credit Card and UPI transactions",
            "config": [
                {
                    "snippetStrings": ["debited from your HDFC Bank Credit Card ending"],
                    "costRegex": "Rs\\.(.*?)\\sis debited",
                    "vendorRegex": "towards\\s(.*?)\\son",
                    "type": "credit-card",
                    "costType": "debit"
                },
                {
                    "snippetStrings": ["Your UPI transaction", "successfully credited"],
                    "costRegex": "\\.(.*?)\\ is successfully credited",
                    "vendorRegex": "VPA\\s(.*?)\\son",
                    "type": "upi",
                    "costType": "credit"
                },
                {
                    "snippetStrings": ["Your UPI transaction"],
                    "costRegex": "Rs\\.(.*?)\\shas been debited",
                    "vendorRegex": "VPA\\s(.*?)\\son",
                    "type": "upi",
                    "costType": "debit"
                },
                {
                    "snippetStrings": ["E-mandate", "has been successfully paid"],
                    "costRegex": "Amount: INR\\s(.*?)\\sDate",
                    "vendorRegex": "Your\\s(.*?)\\sbill",
                    "type": "e-mandate",
                    "costType": "debit"
                }
            ]
        }
    };

    for (const mailIndex in mailIdList) {
        let mailId = mailIdList[mailIndex];
        res = Gmail.Users.Messages.get('me', mailId);

        let snippet = res.snippet;


        console.log("Email snippet ", snippet);

        for (const hdfcIndex in emailParsingConfig.v1.config) {
            const config = emailParsingConfig.v1.config[hdfcIndex];

            let expense = null;
            let type = '';
            let cost;
            let vendor;

            let subStringFound = true;
            for (const subString of config.snippetStrings) {
                if (!snippet.includes(subString)) {
                    subStringFound = false;
                    break;
                }
            }

            if (subStringFound) {
                type = config.type;
                try {
                    console.log('-> Matched config strings: ', config.snippetStrings);
                    cost = snippet.match(new RegExp(config.costRegex))[1];
                    vendor = snippet.match(new RegExp(config.vendorRegex))[1];

                    expense = getExpense(Number(res.internalDate), config.type, mailId);
                    expense.costType = config.costType;

                    console.log('-> Cost: ', cost);
                    console.log('-> Vendor: ', vendor);

                    expense.cost = Number(cost)
                    expense.vendor = vendor.toUpperCase().substring(0, 50);

                    const obj = vendorTag.find(({vendor}) => expense.vendor === vendor);

                    if (obj) {
                        expense.tag = obj.tag;
                    }

                    // await addExpense(expense, accessToken);

                    console.log('-> ', type.toUpperCase(), ' cost: ', expense.cost);
                    console.log('-> ', type.toUpperCase(), ' vendor: ', expense.vendor);
                    console.log('-> ', type.toUpperCase(), ' expense: ', expense);

                } catch (e) {
                    console.error('Error parsing snippet with config: ', config, e);
                }
                break; // Exit the loop after the first matching config
            }


        }


        lastMailId = mailId;

    }


    // if (lastMailId) {
    //     console.log('Post execution last mail id ', lastMailId);
    //     setOneDoc("config", "lastGmailId", lastMailId, accessToken);
    // }


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