import { StyleSheet } from 'react-native';

// Visuals: this is the "CSS" for mobile app, handles presentation while HTML handles structure
export const styles = StyleSheet.create({
    // this organizes all styles into one object, better than a plain object because it provides autofill and catches errors
    container: { // main screen
        flex: 1, // tells view to expand and fill entire screen
        backgroundColor: '#f2f2f7', // light grey background
        alignItems: 'center', // centers all the children (labels, cards) horizontally 
        justifyContent: 'flex-start', // centers everything vertically
        paddingTop: 10, //manual centering for top portion
        paddingHorizontal: 20, //leaves a gap of 20 units between screen edge and content
    },
    label: {
        fontSize: 12, // small text
        color: '#8e8e93',
        textTransform: 'uppercase', // automatically capitalizes every letter
        letterSpacing: 1 // adds a bit of space between each letter to make uppercase text easier to read
    },
    statusText: {
        fontSize: 22, // large text
        fontWeight: 'bold', // thick font
        color: '#1c1c1e', // off-black, easier on the eyes than #000000
        marginBottom: 40 // creates a large 40 unit gap underneath the status
    },
    statusCard: {
        backgroundColor: '#ffffff', // pure white
        padding: 25, // space inside the box so text isn't touching box edges
        borderRadius: 20, // rounded corners
        width: '100%', // tells card to be as wide as possible (minus container's 20 unit padding)
        // shadows for a floating look
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5, // Android shadow
        marginBottom: 20
        },
    userCard: {
        backgroundColor: '#ffffff',
        padding: 25,
        borderRadius: 20,
        width: '100%',
    },
    box: {
        backgroundColor: 'lightgrey',
        padding: 15,
        borderRadius: 20,
        width: '60%',
        marginTop: 15
    },
    cardTitle: {
        fontSize: 14,
        color: '#3a3a3c',
        marginBottom: 8
    },
    messageText: {
        fontSize: 20,
        color: '#007aff', // ios blue
        fontWeight: '600' // semi-bold
    },
    IDText: {
        fontSize: 12,
        color: '#8e8e93',
        marginTop: 10,
        fontFamily: 'Courier'
    },
    friendBadge: {
        backgroundColor: '#f0f0f5',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 12,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#e5e5ea'
    },
    friendIdText: {
        fontSize: 15,
        color: '#3a3a3c',
        fontFamily: 'Courier'
    },
    input: {
        fontSize: 20,
        color: 'black',

    },
    colorContainer: {
        flexDirection: 'row',        // Lays circles out in a horizontal line
        flexWrap: 'wrap',
        justifyContent: 'center',    // Centers them horizontally
        marginVertical: 20,          // Adds space above and below the row
        gap: 15,                     // Adds space between the circles
    },
    colorCircle: {
        width: 45,                   // Size of the circle
        height: 45,
        borderRadius: 22.5,          // Makes it a perfect circle (half of width)
        borderColor: '#000',         // Black border for the "selected" look
    },
    button: {
        backgroundColor: '#007aff',  // Nice iOS-style blue
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 10,
        marginTop: 20,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',               // White text on the blue button
        fontSize: 18,
        fontWeight: 'bold',
  },
});