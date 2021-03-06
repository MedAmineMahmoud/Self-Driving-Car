// https://stackoverflow.com/questions/494143/creating-a-new-dom-element-from-an-html-string-using-built-in-dom-methods-or-pro/35385518#35385518
function htmlToElement(html) {
    var template = document.createElement('template');
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
    return template.content.firstChild;
}

function getHtmlString(url) {
    return new Promise(function(resolve, reject) {
        $.get( url, function(htmlString) {
            resolve(htmlString);
        });
    });
}

async function getHtml(url){
    const htmlString = await getHtmlString(url);
    const html = htmlToElement(htmlString);
    return html
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  var angleInRadians = (angleInDegrees-90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}

function describeArc(x, y, radius, startAngle, endAngle){
    var start = polarToCartesian(x, y, radius, endAngle);
    var end = polarToCartesian(x, y, radius, startAngle);
    var largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    var d = [
        "M", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
    return d;
}

/**
 * @param {element} svg - SVG element containing the circle progress
 * @param {int} percent - Amount between 0 and 100
 */
function updateProgressCircle(svg,rawPercent){
    const percent = rawPercent.toFixed(0);
    /*
     * My circular path function fails with I specify a full 360
     * degrees, so I rely on a circle svg instead when I want to
     * show a complete circle
     */
    const fullGreenCircle = svg.querySelector("circle.full-circle-progress");
    const partialGreenCircle = svg.querySelector("path.partial-circle-progress");
    const progressText = svg.querySelector("text.circle-progress-text");
    if (percent == 100){
        fullGreenCircle.style.display = 'block';
        partialGreenCircle.style.display = 'none';
        progressText.textContent = percent;
    } else {
        fullGreenCircle.style.display = 'none';
        partialGreenCircle.style.display = 'block';
        const centerX = 0;
        const centerY = 0;
        const radius = 40;
        const startAngle = 0;
        const endAngle = (360 * (percent/100)).toFixed(0);
        partialGreenCircle.setAttribute("d", describeArc(centerX, centerY, radius, startAngle, endAngle));
        progressText.textContent = percent;
    }
}

function writeToggle(input) {
    return new Promise(function(resolve, reject) {
        $.post('/write-toggle', input, function(){
            resolve();
        });
    });
}

function readToggle(input) {
    return new Promise(function(resolve, reject) {
        $.post('/read-toggle', input, function(output){
            resolve(output['is_on']);
        });
    });
}

function writeSlider(input) {
    return new Promise(function(resolve, reject) {
        $.post('/write-slider', input, function(){
            resolve();
        });
    });
}

function readSlider(input) {
    return new Promise(function(resolve, reject) {
        $.post('/read-slider', input, function(output){
            resolve(output['amount']);
        });
    });
}

function raspberryPiConnectionTest() {
    return new Promise(function(resolve, reject) {
        $.ajax({
            method: 'POST',
            url: '/raspberry-pi-healthcheck',
            timeout: 3000, // 1000 was not enough and led to about 50% failed health checks
            success: function(response) {
                resolve(response['is_able_to_connect']);
            },
            error: function(){
                resolve(false);
            }
        });
    });
}

async function updateToggleHtmlFromDB(checkbox){
    const webPage = checkbox.getAttribute('toggle-web-page');
    const name = checkbox.getAttribute('toggle-name');
    const detail = checkbox.getAttribute('toggle-detail');
    const readInput = JSON.stringify({
            'web_page': webPage,
            'name': name,
            'detail': detail
    });
    const is_on = await readToggle(readInput);
    checkbox.checked = is_on;
}

function configureToggle(checkbox){
    const webPage = checkbox.getAttribute('toggle-web-page');
    const name = checkbox.getAttribute('toggle-name');
    const detail = checkbox.getAttribute('toggle-detail');
    checkbox.onclick = function(){
        const writeInput = JSON.stringify({
            'web_page': webPage,
            'name': name,
            'detail': detail,
            'is_on': checkbox.checked
        });
        writeToggle(writeInput);
    }
    const checkToggleTime = setInterval(function(){
        updateToggleHtmlFromDB(checkbox);
    }, 5000);

}

function configureRadioGroup(checkbox){
    /*
    In Javascript, a "radio group" is a collection of radio
    buttons where only one radio of the group of radios can
    be selected at a given time. For example, I use radio
    groups so that the user can select whether to use the
    model on the Pi or on the laptop for driving the car in
    real-time. The car can't use angles from both services,
    so if you select one, the other(s) must be unselected
    automatically.

    However, it seems javascript doesn't support onchange
    events for the radio buttons that aren't clicked. So as
    a hack, when a user selects a radio button I trigger a
    function that checks for all buttons of the same group
    (inputs of the same "toggle-name" value that also
    belong to the "tracked-radio-group" class), and loop
    through each, updating the DB accordingly. There might
    be a more elegant way to do this, but I think this is
    the most readable and easiest to understand for my
    future self
    */

    /*
    These attributes will be the same for all radios belonging
    to the same group
    */
    const webPage = checkbox.getAttribute('toggle-web-page');
    const name = checkbox.getAttribute('toggle-name');

    checkbox.addEventListener('change', function(){

        /*
        This will select all radios belonging to the group, which
        is convenient because then you don't need separate code
        for the selected vs unselected radios. You just loop
        through each and examine whether it's checked or not
        */
        const radios = document.querySelectorAll('input.tracked-radio-group, '+'[toggle-name='+name+']');

        // Go through all of the radios in the group
        for (const radio of radios){
            const detail = radio.getAttribute('toggle-detail');
            const radioDetails = JSON.stringify({
                'web_page': webPage,
                'name': name,
                'detail': detail,
                'is_on': radio.checked
            });
            writeToggle(radioDetails);
        }
    });
    const checkToggleTime = setInterval(function(){
        updateToggleHtmlFromDB(checkbox);
    }, 5000);

}

async function updatePiConnectionStatuses(){
    const statuses = document.querySelectorAll('span.raspberry-pi-connection-status');
    const isHealthy = await raspberryPiConnectionTest();
    if(isHealthy == true){
        for (const status of statuses){
            status.classList.remove('text-danger');
            status.classList.add('text-success');
            status.style.display = 'inline';
        }
    } else {
        for (const status of statuses){
            status.classList.remove('text-success');
            status.classList.add('text-danger');
            status.style.display = 'inline';
        }
    }
    return isHealthy
}

/*
Prior to writing this function I would recreate the
steering / angle donut everytime I changed rotation.
While this didn't have any noticeable impact on the
laptop it caused massive CPU utilization on iOS and
made the iPhone experience awful -- the entire UI
would go unresponive, the app would crash and you
would have to do a hard refresh just to re-open the
modal. The fix is to create the donuts once and
simply update the values of existing objects
*/
function makeDonut(donutId){
    const options = {
        'cutoutPercentage':50,
        'rotation':0,
        'animation': {
            'animateRotate':false
        }
    }
    const donut = new Chart(donutId, {
        type: 'doughnut',
        data: {
          datasets: [{
            data: [50, 50],
            'borderWidth':[1,1],
            'backgroundColor':['#E3EBF6','#2C7BE5']
          }]
        },
        options: options
    });
    return donut;
}

function updateDonut(donut, angle){
    /*
    Angle is between -1 and 1 so need to scale
    to rotate donut appropriately. Full left is
    -0.5, middle is 0.0, and full right is 0.5
    */
    const scaledAngle = angle / 2;
    const rotation = scaledAngle * Math.PI;
    donut.options.rotation = rotation;
    donut.update();
}

async function configureSlider(config){
    const inputQuery = JSON.stringify({
        'web_page': config['web_page'],
        'name': config['name']
    });
    const startAmount = await readSlider(inputQuery);
    const sliderId = config['sliderId'];
    const slider = $("#"+sliderId);
    slider.attr("data-slider-value",startAmount);
    slider.attr("data-slider-step",config['step']);
    slider.attr("data-slider-max",config['max']);
    slider.attr("data-slider-min",config['min']);
    slider.slider();
    const sliderTextId = sliderId + "-text";
    const sliderText = $("#"+sliderTextId);
    // Initialize
    if (config['type']=='percent'){
        sliderText.text(startAmount+"%");
    } else if (config['type']=='reduceFactor') {
        sliderText.text('1/'+startAmount);
    } else {
        sliderText.text(startAmount);
    }
    // Change on slide
    slider.on("slide", function(slideEvent) {
        if (config['type']=='percent'){
            sliderText.text(slideEvent.value+"%");
        } else if (config['type']=='reduceFactor') {
            sliderText.text('1/'+slideEvent.value);
        } else {
            sliderText.text(slideEvent.value);
        }
        const input = JSON.stringify({
            'web_page': config['web_page'],
            'name': config['name'],
            'amount': slideEvent.value
        });
        writeSlider(input);
    });
}

function deployModel(data) {
    return new Promise(function(resolve, reject){
        const jsonData = JSON.stringify(data);
        $.post('/deploy-model', jsonData, function(result){
            resolve(result);
        });
    });
}

function getModelDeployments(){
    return new Promise(function(resolve, reject){
        $.post('/list-model-deployments', function(result){
           resolve(result)
        });
    });
}

function deploymentHealth(device) {
    return new Promise(function(resolve, reject){
        const jsonData = JSON.stringify({
            'device':device
        });
        $.post('/deployment-health', jsonData, function(result){
            resolve(result);
        });
    });
}

/*
Call like this:
    measureLatency(getAiAngle('dataset_5_18-10-20',460))
*/
async function measureLatency(functionTested){
    const start = new Date();
    await functionTested
    const end = new Date();
    const seconds = (end.getTime() - start.getTime()) / 1000;
    return seconds
}

// Got code example from here: https://codehandbook.org/javascript-date-format/
// Returns in format: "2018-10-19 17:25:56"
function getDateTime(){
    const current_datetime = new Date()
    const formatted_date = current_datetime.getFullYear() + "-" + (current_datetime.getMonth() + 1) + "-" + current_datetime.getDate() + " " + current_datetime.getHours() + ":" + current_datetime.getMinutes() + ":" + current_datetime.getSeconds()
    return formatted_date
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function updateServiceStatusIcon(args){
    const status = document.querySelector('span.' + args['service'] + '-status');
    if(args['status'] == 'healthy'){
        status.classList.remove('text-danger');
        status.classList.remove('text-primary');
        status.classList.remove('text-light');
        status.classList.remove('text-warning');
        status.classList.add('text-success');
        status.style.display = 'inline';
    } else if (args['status'] == 'unhealthy') {
        status.classList.remove('text-success');
        status.classList.remove('text-primary');
        status.classList.remove('text-light');
        status.classList.remove('text-warning');
        status.classList.add('text-danger');
        status.style.display = 'inline';
    } else if (args['status'] == 'in-progress') {
        status.classList.remove('text-success');
        status.classList.remove('text-primary');
        status.classList.remove('text-light');
        status.classList.remove('text-danger');
        status.classList.add('text-warning');
        status.style.display = 'inline';
    } else if (args['status'] == 'ps3-ready-to-pair') {
        status.classList.remove('text-success');
        status.classList.remove('text-light');
        status.classList.remove('text-warning');
        status.classList.remove('text-danger');
        status.classList.add('text-primary');
        status.style.display = 'inline';
    } else {
        status.classList.remove('text-success');
        status.classList.remove('text-primary');
        status.classList.remove('text-danger');
        status.classList.remove('text-warning');
        status.classList.add('text-light');
        status.style.display = 'inline';
    }
}

function getServiceStatus(service) {
    /*
    Gets the status of a Pi service. This is used to determine
    the color to assign a service's status dot. Possible statuses
    include the following:
        - ready-to-start
        - starting-up
        - healthy
        - unhealthy
        - ready-to-shut-down
        - shutting-down
        - off
        - invincible-zombie
        - invalid-status
    */
    return new Promise(function(resolve, reject) {
        const input = JSON.stringify({'service': service});
        $.ajax({
            method: 'POST',
            url: '/pi-service-status',
            timeout: 2500,
            data: input,
            success: function(output) {
                resolve(output['status']);
            },
            error: function(){
                resolve('unhealthy');
            }
        });
    });
}

async function updateServiceHealth(service){
    /*
    This function changes the colored dots next to each service to
    indicate its status (whether its healthy, etc)
    */
    const status = await getServiceStatus(service);

    // Separate statuses by color
    const changing = ['ready-to-start', 'starting-up', 'ready-to-shut-down', 'shutting-down']
    const bad = ['unhealthy','invincible-zombie','invalid-status']
    const good = ['healthy']
    const nothing = ['off']

    if (changing.includes(status)){
        updateServiceStatusIcon({
            'service':service,
            'status':'in-progress'
        });
    } else if (good.includes(status)) {
        if (service == 'ps3-controller'){
            const isSixAxisLooping = await getPS3ControllerHealth();
            if (isSixAxisLooping == true){
                updateServiceStatusIcon({
                    'service':service,
                    'status':'healthy'
                });
            } else {
                updateServiceStatusIcon({
                    'service':service,
                    'status':'ps3-ready-to-pair'
                });
            }
        } else {
            updateServiceStatusIcon({
                'service':service,
                'status':'healthy'
            });
        }
    } else if (bad.includes(status)) {
        updateServiceStatusIcon({
            'service':service,
            'status':'unhealthy'
        });
    } else if (nothing.includes(status)) {
        updateServiceStatusIcon({
            'service':service,
            'status':'inactive'
        });
    } else {
        // This should never happen
        console.log("Status of "+status+" for " + service + " service isn't valid");
        updateServiceStatusIcon({
            'service':service,
            'status':'unhealthy'
        });
    }
}
