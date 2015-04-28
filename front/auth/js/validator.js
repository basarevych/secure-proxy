function validateFormField(element) {
    var name = element.attr('name');
    var value = element.val();

    var errors = [];
    switch (name) {
        case 'login':
            if (value.trim() == '')
                errors.push('FIELD_EMPTY');
            break;
        case 'password':
            if (value.trim() == '')
                errors.push('FIELD_EMPTY');
            break;
    }

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
