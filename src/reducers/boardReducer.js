import boardData from "../constants/boardData";
import { actionTypes } from "../constants/actionTypes";
import prereqMap from "../constants/prereqMap";
import uuid from "uuid4";

const reorder = (list, startIndex, endIndex) => {
  const result = [...list];

  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

// Dragging within the same semester
const dragWithinSemester = (board, sourceList, sourceIndex, destinationIndex, sourceId, sourceYearId) => {
  const newCourses = reorder(sourceList.courses, sourceIndex, destinationIndex);
  // console.log(newCourses);
  let newBoard = [...board];

  newBoard = newBoard.map((year) => {
    if (year.id === sourceYearId) {
      year.semesters.map((semester) => {
        if (semester.id === sourceId)
          semester.courses = newCourses;

        return semester;
      });
    }

    return year;
  });

  return newBoard;
};


const validateBoard = (board) => {
  console.log('checking..');
  console.log(prereqMap);
  for (var i = 0; i < board.length; i++) {
    var year = board[i]["semesters"];
    for (var j = 0; j < year.length; j++) {
      var sem = year[j]["courses"];
      for (var k = 0; k < sem.length; k++) {
        if(sem[k].manualApprove === true){
          sem[k]["valid"] = '1';
          continue;
        } 
        var name = sem[k]["courseName"].match('[A-Z]+ [0-9]+')
        if (name && name.length === 1) {
          name = name[0].replace(' ', '').toLowerCase();
          var mapped = prereqMap[0][name];
          console.log(mapped);
          if (!mapped || Object.keys(mapped).length === 0) continue;
          var res = validateCourse(board, mapped, i, j);

          if (!res["result"]) {
            var reason = prereqMap[0][name][res["type"]];
            console.log(reason)
            if(reason.startsWith("SPX"))
              reason = reason.split(": ")[1]
            sem[k]["valid"] = res["type"] + ": " + reason;
            console.log(sem[k]["valid"]);
          } else {
            sem[k]["valid"] = '1';
          }
        }
      }
    }
  }
};

const validateReq = (board, course, yearId, semId, req) => {
  if (course[req].startsWith("SPX"))
    return false;

  var add = 0;
  if (req === "Coreq" || req === "PreOrCoreq")
    add = 1;

  if (!(req in course))
    return true;
  var evalStr = course[req].replace(/and/g, '&&').replace(/or/g, '||');
  for (var i = 0; i <= yearId; i++) {
    var year = board[i]["semesters"];
    var limit = i === yearId ? semId + add : year.length;
    for (var j = 0; j < limit; j++) {
      var sem = year[j]["courses"];
      for (var k = 0; k < sem.length; k++) {
        var currName = sem[k].courseName.match('[A-Z]+ [0-9]+')
        if (evalStr.includes(currName)) {
          evalStr = evalStr.replace(currName, 'true');
        }
      }
    }
  }
  evalStr = evalStr.replace(/[A-Z]+ [0-9]+/g, "false");
  // it's a necessary evil
  // eslint-disable-next-line
  var res = eval(evalStr);
  // if (!res)
  // console.log(course);
  return res;
};

const validateCourse = (board, course, yearId, semId) => {
  var good = true;
  var result = { "type": "" };
  if ("Prereq" in course) {
    var res = validateReq(board, course, yearId, semId, "Prereq");
    if (!res)
      result["type"] = "Prereq";
    good &= res;
  }
  if ("Coreq" in course) {
    res = validateReq(board, course, yearId, semId, "Coreq");
    if (!res)
      result["type"] = "Coreq";
    good &= res;
  }
  if ("PreOrCoreq" in course) {
    res = validateReq(board, course, yearId, semId, "PreOrCoreq");
    if (!res)
      result["type"] = "PreOrCoreq";
    good &= res;
  }
  result["result"] = good;
  return result;
};

// Dragging between two semesters
const dragBetweenSemesters = (board, sourceList, destinationList, sourceIndex, destinationIndex, sourceId, destinationId, sourceYearId, destinationYearId) => {

  // Get the dragged course from source semester
  let newSourceCourses = [...sourceList.courses];
  const [draggedCourse] = newSourceCourses.splice(sourceIndex, 1);

  // Insert dragged course into destination semester
  let newDestCourses = [...destinationList.courses];
  newDestCourses.splice(destinationIndex, 0, draggedCourse);

  let newBoard = [...board];

  newBoard = newBoard.map((year) => {
    // Remove course from original semester
    if (year.id === sourceYearId) {
      year.semesters.map((semester) => {
        if (semester.id === sourceId)
          semester.courses = newSourceCourses;

        return semester;
      });
    }

    // Add course to new semester
    if (year.id === destinationYearId) {
      year.semesters.map((semester) => {
        if (semester.id === destinationId)
          semester.courses = newDestCourses;

        return semester;

      });
    }

    return year;
  });

  return newBoard;
};

const boardReducer = (state = boardData, action) => {
  switch (action.type) {
    case actionTypes.ADD_COURSE: {
      const { courseName, yearIndex, semesterIndex } = action.payload;

      const newCourse = {
        id: uuid(),
        valid: '1',
        courseName: courseName
      };

      // console.log(newCourse);

      const destinationYear = state[yearIndex];
      const destinationSemester = destinationYear.semesters[semesterIndex];
      const destinationCourses = destinationSemester.courses;

      let newCourses = [...destinationCourses];
      newCourses.splice(newCourses.length, 0, newCourse);

      let newBoard = [...state];

      newBoard = newBoard.map((year) => {
        // Add course to semester
        if (year.id === destinationYear.id) {
          year.semesters.map((semester) => {
            if (semester.id === destinationSemester.id)
              semester.courses = newCourses;

            return semester;

          });
        }

        return year;
      });
      validateBoard(newBoard);
      return newBoard;
    }

    case actionTypes.DELETE_COURSE: {
      const { yearIndex, semesterIndex, courseIndex } = action.payload;

      const destinationYear = state[yearIndex];
      const destinationSemester = destinationYear.semesters[semesterIndex];
      const destinationCourses = destinationSemester.courses;

      // Delete course from list
      let courses = [...destinationCourses];
      courses.splice(courseIndex, 1);

      let newBoard = [...state];

      newBoard = newBoard.map((year) => {
        // Remove course from original semester
        if (year.id === destinationYear.id) {
          year.semesters.map((semester) => {
            if (semester.id === destinationSemester.id)
              semester.courses = courses;

            return semester;
          });
        }

        return year;
      });
      validateBoard(newBoard);
      return newBoard;
    }

    case actionTypes.EDIT_COURSE: {
      const { yearIndex, semesterIndex, courseIndex } = action.payload;
      let currBoard = [...state];
      currBoard[yearIndex].semesters[semesterIndex].courses[courseIndex].manualApprove = true;
      validateBoard(currBoard);
      return currBoard;
    }

    case actionTypes.EXPORT_COURSES: {
      // const { json } = action.payload;
      let currBoard = [...state];
      var res = JSON.stringify(currBoard) // (currBoard, null, 2) for pretty print
      alert(res);
      return currBoard;
    }

    case actionTypes.LOAD_COURSE: {
      const { json } = action.payload;
      debugger
      try {
        var newBoard = JSON.parse(json);
        console.log(json);
        validateBoard(newBoard);
        return newBoard;
      } catch (error) {
        return [...state];
      }
    }

    case actionTypes.SET_BOARD: {
      const { newBoard } = action.payload;
      console.log('heyo')
      validateBoard(newBoard);
      console.log(newBoard);
      return newBoard;
    }

    case actionTypes.DRAG_EVENT: {
      const result = action.payload.result;

      const sourceId = result.source.droppableId;
      const destinationId = result.destination.droppableId;

      const sourceIndex = result.source.index;
      const destinationIndex = result.destination.index;
      let sourceList, destinationList;

      // Used when iterating again to update the board
      let sourceYearId, destinationYearId;

      state.map((years) => (
        years.semesters.map((semester) => {
          if (semester.id === sourceId) {
            sourceList = semester;
            sourceYearId = years.id;

          } else if (semester.id === destinationId) {
            destinationList = semester;
            destinationYearId = years.id;

          }

          return semester;
        })
      ));

      const newBoard = !destinationList
        ? dragWithinSemester(state, sourceList, sourceIndex, destinationIndex, sourceId, sourceYearId)
        : dragBetweenSemesters(state, sourceList, destinationList, sourceIndex, destinationIndex, sourceId, destinationId, sourceYearId, destinationYearId);
      validateBoard(newBoard);
      return newBoard;
    }

    default: {
      return state;
    }
  }
};

export default boardReducer;