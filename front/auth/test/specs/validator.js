describe("Validator", function() {
    beforeEach(function (done) {
        $.ajax({
            url: 'test/fixtures/validator.html',
            dataType: 'html',
            success: function (html) {
                var fixture = $('<div id="fixture"></div>');
                $('body').append(fixture.append(html));
                done();
            }
        });

        var globalize = {
            formatMessage: function () {}
        };
        window['globalize'] = globalize;
        spyOn(globalize, 'formatMessage');
    });

    afterEach(function () {
        $('#fixture').remove();
    });

    it("checks for empty value", function() {
        validateFormField($('input[name=field]'));
        expect(globalize.formatMessage).toHaveBeenCalledWith('FIELD_EMPTY');
    });
});
