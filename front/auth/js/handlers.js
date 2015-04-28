$(document).on('keypress', '[data-on-enter]', function (e) {
    if (e.keyCode == 13) {
        eval($(this).attr('data-on-enter'));
        return false;
    }
});

$(document).on('blur', '[data-on-blur]', function (e) {
    var code = $(this).attr('data-on-blur');
    setTimeout(function () { eval(code); }, 500);
});
