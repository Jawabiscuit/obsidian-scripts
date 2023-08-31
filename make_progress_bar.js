
const filled_char = "█"
const unfilled_char = "◽"


function make_progress_bar(numerator, denominator, size, label){
    let percentage = numerator/denominator;
    let max_blocks = size;
    let num_filled = Math.floor(percentage*max_blocks);
    return `${label}: [${filled_char.repeat(num_filled)}${unfilled_char.repeat(max_blocks-num_filled)}] ${Math.floor(percentage*100)}% ( ${numerator}/${denominator} )`
    // return `${label}: [${filled_char.repeat(max_blocks)}] ${Math.floor(percentage*100)}% ( ${numerator}/${denominator} )`
}

module.exports = make_progress_bar;
