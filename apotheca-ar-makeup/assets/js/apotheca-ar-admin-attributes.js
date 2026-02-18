(function($){
  'use strict';

  // Debug helper (visible in browser console)
  console.log('[Apotheca AR] Admin Attributes helper loaded');

  function appendToData(data, key, value){
    if (value === undefined || value === null) return data;

    var k = encodeURIComponent(key);
    var pair = k + '=' + encodeURIComponent(value);

    if (typeof data === 'string') {
      if (data.indexOf(k + '=') !== -1) return data;
      return data.length ? (data + '&' + pair) : pair;
    }

    if ($.isPlainObject(data)) {
      if (typeof data[key] !== 'undefined') return data;
      data[key] = value;
      return data;
    }

    return data;
  }

  var allowedActions = {
    'woocommerce_add_attribute': true,
    'woocommerce_update_attribute': true,
    'woocommerce_save_attribute': true
  };

  $.ajaxPrefilter(function(options, originalOptions){
    var data = originalOptions.data;
    if (!data) return;

    var action = null;
    if (typeof data === 'string') {
      var m = data.match(/(?:^|&)action=([^&]+)/);
      if (m && m[1]) action = decodeURIComponent(m[1]);
    } else if ($.isPlainObject(data)) {
      action = data.action;
    }

    if (!action || !allowedActions[action]) return;

    console.log('[Apotheca AR] Intercepting WC attribute request:', action);

    var regionVal = $('#apotheca_ar_face_region').val();
    var nonceVal  = $('input[name="apotheca_ar_attribute_face_region_nonce"]').val();

    data = appendToData(data, 'apotheca_ar_face_region', regionVal);
    data = appendToData(data, 'apotheca_ar_attribute_face_region_nonce', nonceVal);

    console.log('[Apotheca AR] Appended face region:', regionVal, 'nonce present:', !!nonceVal);

    options.data = data;
  });

})(jQuery);
