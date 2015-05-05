function validateFormField(element) {
    var name = element.attr('name');
    var value = element.val();

    var errors = [];
    if (value.trim() == '')
        errors.push('FIELD_EMPTY');

    var gl = window['globalize'],
        formGroup = element.closest('.form-group'),
        ul = formGroup.find('.help-block ul');

    ul.empty();
    if (errors.length) {
        formGroup.addClass('has-error');
        for (var i = 0; i < errors.length; i++) {
            var li = $('<li></li>');
            li.text(gl.formatMessage(errors[i]))
              .appendTo(ul);
        }
    } else {
        formGroup.removeClass('has-error');
    }

    return errors.length == 0;
}
