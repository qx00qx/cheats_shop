$( document ).ready(function() {
    
    $('[data-fancybox="screenshots"]').fancybox({
        backFocus : false
    });

    $('.smallfaq__item b').on('click touch', function(){
        var parent = $(this).parent();
        if(parent.hasClass('active')){
            parent.removeClass('active');
        }
        else {
            parent.addClass('active');
        }
    });

    alertify.set('notifier','position', 'top-center');

    if($('.buy_block').length){
        var priceNow = parseInt($('.content__item-radio.active b').text().split(' Руб')[0]);
        if(priceNow < 500){
            $('.type_selector option[value="41"]').attr('disabled', 'disabled');
            $('.type_selector option[value="4"]').attr('disabled', 'disabled');
            $('.type_selector option[value="7"]').attr('disabled', 'disabled');
            $('.type_selector option[value="8"]').attr('disabled', 'disabled');
            $('.type_selector option[value="12"]').attr('disabled', 'disabled');
            $('.type_selector option[value="6"]').attr('disabled', 'disabled');
            $('.type_selector option[value="42"]').attr('disabled', 'disabled');
            // $('.type_selector option[value="43"]').attr('disabled', 'disabled');
        }
        if(priceNow < 1000){
            if(priceNow >= 500){
                $('.type_selector option[value="6"]').attr('disabled', 'disabled');
                $('.type_selector option[value="42"]').attr('disabled', 'disabled');
                // $('.type_selector option[value="43"]').attr('disabled', 'disabled');
            }
        }
        if(priceNow < 3000){
            if(priceNow > 500){
                if(priceNow > 1000){
                    $('.type_selector option[value="41"]').attr('disabled', 'disabled');
                }
            }
        }
        $('.content__item-radio').on('click touch', function(){
            if(!$(this).hasClass('active')){
                var priceNow = parseInt($(this).find('b').text().split(' Руб')[0]);
                if(priceNow < 500){
                    $('.type_selector option[value="41"]').attr('disabled', 'disabled');
                    $('.type_selector option[value="4"]').attr('disabled', 'disabled');
                    $('.type_selector option[value="7"]').attr('disabled', 'disabled');
                    $('.type_selector option[value="8"]').attr('disabled', 'disabled');
                    $('.type_selector option[value="12"]').attr('disabled', 'disabled');
                    $('.type_selector option[value="6"]').attr('disabled', 'disabled');
                    $('.type_selector option[value="42"]').attr('disabled', 'disabled');
                    // $('.type_selector option[value="43"]').attr('disabled', 'disabled');
                }
                if(priceNow < 1000){
                    if(priceNow >= 500){
                        $('.type_selector option[value="6"]').attr('disabled', 'disabled');
                        $('.type_selector option[value="42"]').attr('disabled', 'disabled');
                        // $('.type_selector option[value="43"]').attr('disabled', 'disabled');
                        //
                        $('.type_selector option[value="41"]').removeAttr('disabled');
                        $('.type_selector option[value="4"]').removeAttr('disabled');
                        $('.type_selector option[value="7"]').removeAttr('disabled');
                        $('.type_selector option[value="8"]').removeAttr('disabled');
                        $('.type_selector option[value="12"]').removeAttr('disabled');

                    }
                }
                if(priceNow < 3000){
                    if(priceNow > 500){
                        if(priceNow >= 1000){
                            $('.type_selector option[value="41"]').attr('disabled', 'disabled');
                            //
                            $('.type_selector option[value="4"]').removeAttr('disabled');
                            $('.type_selector option[value="7"]').removeAttr('disabled');
                            $('.type_selector option[value="8"]').removeAttr('disabled');
                            $('.type_selector option[value="12"]').removeAttr('disabled');
                            $('.type_selector option[value="6"]').removeAttr('disabled');
                            $('.type_selector option[value="42"]').removeAttr('disabled');
                            // $('.type_selector option[value="43"]').removeAttr('disabled');
                        }
                    }
                }
                else {
                    $('.type_selector option[value="41"]').removeAttr('disabled');
                    $('.type_selector option[value="4"]').removeAttr('disabled');
                    $('.type_selector option[value="7"]').removeAttr('disabled');
                    $('.type_selector option[value="8"]').removeAttr('disabled');
                    $('.type_selector option[value="12"]').removeAttr('disabled');
                    $('.type_selector option[value="6"]').removeAttr('disabled');
                    $('.type_selector option[value="42"]').removeAttr('disabled');
                    // $('.type_selector option[value="43"]').removeAttr('disabled');
                }
            }
        });
    }

    if($('.chat_scroller').length){
        
        $(".chat_scroller").animate({ scrollTop: $('.chat_scroller').prop("scrollHeight")}, 1000);

        setInterval(function(){
            $( ".chat_list" ).load( $('.chat_form').find('input[name="url"]').val()+" .chat_list .chat_content" );
            $(".chat_scroller").animate({ scrollTop: $('.chat_scroller').prop("scrollHeight")}, 0);
        }, 10000);

    }

    if($('.loadmore').length){
        var attr = $('.page-link .pagination-next').parent().attr('href');
        if (typeof attr !== typeof undefined && attr !== false) {               
        }
        else {
            $('.loadmore').remove();
            $('.loadmore_margin').remove();
        }

        if($('.catalog_pagination ul').length){} else {
            $('.loadmore').remove();
            $('.loadmore_margin').remove();
        }
    }

    $('.loadmore').on('click touch', function(){

        if($('.page-link .pagination-next').length){
            nextUrl = $('.page-link .pagination-next').parent().attr('href');
            thisText = $(this);
            thisText.text('Загрузка..');
            $.ajax({url: nextUrl, 
                success: function(data){
                    
                    var dataItems = $(data).find(".ajaxContent .ajaxItem");
                    
                    $('.ajaxContent').append(dataItems);
                    $('.catalog_pagination ul').html($(data).find(".catalog_pagination ul"));
                    thisText.text('Показать еще');

                    var attr = $(data).find('.page-link .pagination-next').parent().attr('href');

                    if (typeof attr !== typeof undefined && attr !== false) {
                        
                    }
                    else {
                        $('.loadmore').remove();
                        $('.loadmore_margin').remove();
                    }

                } 
            });
        }

    });

    body.on("submit", ".chat_form", function () {
        var e = $(this);
        return (
            $.post(
                "/ajax/message",
                e.serializeArray(),
                function (t) {
                    if(t.success){
                        // alertify.success(t.msg);
                        e.find('input[name="message"]').val('');
                        $( ".chat_list" ).load( $('.chat_form').find('input[name="url"]').val()+" .chat_list .chat_content" );
                        setTimeout(function(){
                             $(".chat_scroller").animate({ scrollTop: $('.chat_scroller').prop("scrollHeight")}, 1000);
                        },2000);
                    }
                    else {
                        alertify.error(t.error);
                    }
                },
                "json"
            ),
            !1
        );
    });

    $('body').on('click touch', ".item_up", function () {
        var itemId = $(this).data('id');
        $.ajax({
            url: "/ajax/itemup",
            data: {
                "item_id": itemId
            },
            success: function (t) {
                if(t.success){
                    alertify.success(t.msg);
                    setTimeout(function(){
                        location.reload()
                    },1000);
                }
                else {
                    alertify.error(t.error);
                }
            },
            type: "POST",
            dataType: "json",
        });
    });

    $('.mailInput').keyup(function(){
        if (!$('.paymentBtn').length) {
            return;
        }
        if($('.phoneNumber').length){
            var paymentHref = $('.paymentBtn').attr('href');
            if (!paymentHref) {
                return;
            }
            newBuyHref = paymentHref.split('&mail')[0]+'&mail='+encodeURIComponent($('.mailInput').val())+'&phone='+encodeURIComponent($('.phoneNumber').val());
            $('.paymentBtn').attr('href', newBuyHref);
            if($('.phoneNumber').val().length == 11){
                if($('.mailInput').val().length > 5){
                    $('.paymentBtn').removeClass('disabled');
                }
                else {
                    if(!$('.paymentBtn').hasClass('disabled')){
                        $('.paymentBtn').addClass('disabled');
                    }
                }
            }
            else {
                if(!$('.paymentBtn').hasClass('disabled')){
                    $('.paymentBtn').addClass('disabled');
                }
            }
        }
        else {
            var paymentHref = $('.paymentBtn').attr('href');
            if (!paymentHref) {
                return;
            }
            newBuyHref = paymentHref.split('&mail')[0]+'&mail='+encodeURIComponent($('.mailInput').val());
            $('.paymentBtn').attr('href', newBuyHref);
            if($('.mailInput').val().length > 5){
                $('.paymentBtn').removeClass('disabled');
            }
            else {
                if(!$('.paymentBtn').hasClass('disabled')){
                    $('.paymentBtn').addClass('disabled');
                }
            }  
        }
    });
      
    $('.phoneNumber').keyup(function(){
        if (!$('.paymentBtn').length) {
            return;
        }
        if($('.mailInput').length){
            var paymentHref = $('.paymentBtn').attr('href');
            if (!paymentHref) {
                return;
            }
            newBuyHref = paymentHref.split('&mail')[0]+'&mail='+encodeURIComponent($('.mailInput').val())+'&phone='+encodeURIComponent($('.phoneNumber').val());
            $('.paymentBtn').attr('href', newBuyHref);
            if($('.mailInput').val().length > 5){
                if($('.phoneNumber').val().length == 11){
                    $('.paymentBtn').removeClass('disabled');

                }
                else {
                    if(!$('.paymentBtn').hasClass('disabled')){
                        $('.paymentBtn').addClass('disabled');
                    }
                }
            }
            else {
                if(!$('.paymentBtn').hasClass('disabled')){
                    $('.paymentBtn').addClass('disabled');
                }
            }
        }
        else {
            var paymentHref = $('.paymentBtn').attr('href');
            if (!paymentHref) {
                return;
            }
            newBuyHref = paymentHref.split('&mail')[0]+'&mail=&phone='+encodeURIComponent($('.phoneNumber').val());
            $('.paymentBtn').attr('href', newBuyHref);
            if($('.phoneNumber').val().length == 11){
                $('.paymentBtn').removeClass('disabled');
            }
            else {
                if(!$('.paymentBtn').hasClass('disabled')){
                    $('.paymentBtn').addClass('disabled');
                }
            }  
        }
    });
    
    $('.buy_block .content__item-radio').on('click touch', function(){
        if(!$(this).hasClass('active')){
            $('.buy_block .content__item-radio').removeClass('active');
            $(this).addClass('active');
            $('.buy_block input[name="tab"]').val($(this).data('tab'));
        }
    });

    $('.buy_block .buy_submit').on('click touch', function(){
        $('.buy_form').submit();
    });

    $(window).on("load", function () {
        $('.slider_global').owlCarousel({
          loop: true,
          nav: true,
          margin: 30,
          items: 1,
          autoplay: true,
          autoplayTimeout: 3000,
          dots: true
        });
        window.dispatchEvent(new Event('resize'));
        $('.slider_global .owl-nav').css('width', $('.slider_global .owl-dots').width() + 50 + 'px');
    });
    
    function openJivoChat() {
        if (typeof jivo_api !== 'undefined' && typeof jivo_api.open === 'function') {
            jivo_api.open();
            return;
        }
        var tries = 0;
        var timer = setInterval(function () {
            tries += 1;
            if (typeof jivo_api !== 'undefined' && typeof jivo_api.open === 'function') {
                clearInterval(timer);
                jivo_api.open();
            } else if (tries >= 40) {
                clearInterval(timer);
            }
        }, 200);
    }

    function openSupportModal() {
        var mobileMenu = document.getElementById('nxMobileMenu');
        if (mobileMenu) {
            mobileMenu.classList.remove('open');
        }
        if ($('#supportmodal').length && typeof $.fn.modal === 'function') {
            $('#supportmodal').modal();
        }
    }

    $('body').on('click touch', '.js-support-open', function () {
        var mobileMenu = document.getElementById('nxMobileMenu');
        if (mobileMenu) {
            mobileMenu.classList.remove('open');
        }
    });

    $('body').on('click touch', '.supportBtn, a[href="javascript:void(0)"]:contains("24/7")', function (e) {
        e.preventDefault();
        openSupportModal();
    });

    $('body').on('click touch', '.js-support-jivo', function (e) {
        e.preventDefault();
        if (typeof $.modal !== 'undefined' && typeof $.modal.close === 'function') {
            $.modal.close();
        }
        openJivoChat();
    });

    $('body').on('click touch', '#supportmodal a[href*="t.me"]', function () {
        if (typeof $.modal !== 'undefined' && typeof $.modal.close === 'function') {
            $.modal.close();
        }
    });

    $('.menuOpen').click( function(event){
        event.preventDefault();
        $('#mobile-menu').fadeIn();
        $('#mm__wrapper')
            .css('visibility', 'visible')
            .css('transform', 'translateX(0)');
        $("body").css("overflow","hidden");
    });
    $('.mm__close').click( function(){
        $('#mobile-menu').fadeOut();
        $('#mm__wrapper')
            .css('visibility', 'hidden')
            .css('transform', 'translateX(-100%)');
        $("body").css("overflow","auto");
    });

    $('input[type="number"]').keydown(function () {
        if (!$(this).val() || (parseInt($(this).val()) <= $(this).attr('max') && parseInt($(this).val()) >= 0)){
            $(this).data("old", $(this).val());
        }
    });
    $('input[type="number"]').keyup(function () {
        if (!$(this).val() || (parseInt($(this).val()) <= $(this).attr('max') && parseInt($(this).val()) >= 0)){
            // $(this).val($(this).attr('min'));
        }
        else {
            $(this).val($(this).data("old"));
        }
    });

    var options = {
        'form_element': 'content-editable'
    };
    // var options_two = {
    //     'form_element': 'content-editable'
    // };
    if($('.multiple_input').length){
        $('.multiple_input').multiple_inputs(options);
    }
    if($('.multiple_textarea').length){
        $('.multiple_textarea').multiple_textareas(options);
    }
    // $('.multiple_input_textarea').multiple_inputs(options_two);


    $('body').on("input", '.tariffs_list input', function() {
        var getVals = $('.tariffs_list input[style="width: 80%; float: left;"]');
        var finalValue = '';
        getVals.each(function( index ) {
            finalValue += $(this).val()+',';
        });
        console.log(finalValue);
    });

    $('.tagsScript').inputTags({
      max: 100
    });

    $('.tagsScriptTwo').inputTags({
      max: 100,
      delimetr: true,
    });

    $('.inputTags-field').keydown(function(event){
        if(event.keyCode == 13) {
            // alert('You pressed enter! Form submission will be disabled.')
            event.preventDefault();
            return false;
        }
    });

});