
function remove_digits (arr) {
    return arr.filter(x => isNaN(x));
}


function lowercase_words (arr) {
    return arr.map(word => {
        return word.toLowerCase();
    });
}


function is_business_day (date) {
    var day = date.getDay();
    if (day == 0 || day == 6) {
        return false;
    }
    return true;
}


/**
 * Get the next or previous day
 * - Gets the day of the month(1-31) for the given day
 * - Then adds the difference between the given day's day of the week (0-6)
 *   and the desired day of the week (0-6)
 * - Then uses mod to make sure the new value isn't more than 6
 * @param  {Date} date Starting date object
 * @param  {int}  dow Day of week (0-6)
 * @return {Date} Next or previous day
*/
function get_next_day (date, dow) {
    date.setDate(date.getDate() + (dow + (7 - date.getDay())) % 7);
    return date;
}


/**
 * Get the next or previous business day
 * @param  {Date} date Starting date object
 * @param  {int}  inc Increment value, can be negative
 * @return {Date} Next or previous business day
*/
function get_next_business_day (date, inc) {
    if (! ( -1 <= inc && inc <= 1 )) {
        console.error("n must be a value between -1 and 1");
        return date;
    }
    while (!is_business_day(date)) {
        date.setDate(date.getDate() + inc);
    }
    return date;
}


/*
 * E.g. 2022-08-31-pipeline
*/
const regex = /^(\d{4}-\d{2}-\d{2})/;


/**
 * Create a new date object from a string prefixed with a date
 * @param  {str}
 * @return {Date}
*/
function new_date_from_prefix (str) {
    matches = str.match(regex);

    if (matches != null) {
        return new Date(matches[1] + "T00:00");
    }
}


function file_name_to_nav_old (date, name) {
    words = remove_digits(name.split("-"));
    return date + "-" + lowercase_words(words).join("-");
}


/**
 * Create text for navigation link
 * @param  {str} name File name that includes a date prefix
 * @param  {int} inc Increment value, can be negative
 * @return {str} Name with date portion incremented if the given string is date prefixed
*/
function file_name_to_nav (name, inc) {
    date = new_date_from_prefix(name);

    if (date === null) {
        return name;
    }

    prev_date_str = date.toISOString().split("T")[0];
    name_without_date = name.split(prev_date_str)[1].replace("-", "");

    // Increment
    date.setDate(date.getDate() + inc);
    // Ensure next date is a business day
    get_next_business_day(date, inc);
    date_str = date.toISOString().split("T")[0];

    if (name_without_date != "") {
        return date_str + "-" + name_without_date;
    }
    return date_str
}


module.exports = file_name_to_nav;
