
function remove_digits (arr) {
    return arr.filter(x => isNaN(x));
}


function capitalize_words (arr) {
    return arr.map(word => {
        return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
    });
}


/*
 * E.g. 2022-08-31-pipeline
*/
const regex = /^(\d{4}-\d{2}-\d{2})-/;


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


function file_name_to_title (name) {
    date = new_date_from_prefix(name);

    if (date === null) {
        return name;
    }

    date_str = date.toISOString().split("T")[0];
    name_without_date = name.split(date_str)[1].replace("-", "");

    return capitalize_words(name_without_date.split("-")).join(" ");
}


module.exports = file_name_to_title;
