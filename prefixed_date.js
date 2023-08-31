/*
 * E.g. 2022-08-31-pipeline
*/
const regex = /^(\d{4}-\d{2}-\d{2})/;


/**
 * Create a new date object from a string prefixed with a date
 * @param  {str}
 * @return {str}
*/
function prefixed_date (str) {
    matches = str.match(regex);

    if (matches != null) {
        date = new Date(matches[1]);
        return date.toISOString().split("T")[0];
    }
    return str;
}


module.exports = prefixed_date;
